import type { CreateTextIntake } from '../../contracts/document-text';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSession } from '../../app/Session';
import { assertOwner, type CreateIntake, type IntakeRequest } from '../../contracts/intake';
import { readableError } from '../../services/types';

interface MaterialsValue {
  requests: IntakeRequest[]; loading: boolean; error: string;
  hasMore: boolean; loadingMore: boolean; loadMore(): Promise<void>;
  uploading: boolean; uploadError: string; refresh(): Promise<void>;
  upsert(request: IntakeRequest): void;
  upload(input: CreateIntake | CreateTextIntake, key: string): Promise<IntakeRequest>; cancelUpload(): void;
}
const Context = createContext<MaterialsValue | null>(null);
export function MaterialsProvider({ children }: { children: ReactNode }) {
  const { profile, services } = useSession();
  const uid = profile?.id;
  const [requests, setRequests] = useState<IntakeRequest[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null), [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false), [uploadError, setUploadError] = useState('');
  const controller = useRef<AbortController | null>(null), activeUid = useRef(uid), read = useRef<AbortController | null>(null);
  const upsert = useCallback((request: IntakeRequest) => {
    if (!activeUid.current) return;
    assertOwner(request, activeUid.current);
    setRequests(old => [request, ...old.filter(r => r.id !== request.id)].sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
  }, []);
  const refresh = useCallback(async () => {
    if (!uid) return;
    read.current?.abort(); const request = new AbortController(); read.current = request;
    setLoading(true); setLoadingMore(false); setError('');
    try {
      const page = services.intake.listPage ? await services.intake.listPage(undefined, request.signal) : { requests: await services.intake.list(request.signal), nextCursor: null };
      const next = page.requests;
      if (request.signal.aborted || activeUid.current !== uid) return;
      next.forEach(r => assertOwner(r, uid)); setNextCursor(page.nextCursor);
      setRequests(previous => next.map(r => {
        const newer = previous.find(old => old.id === r.id && Date.parse(old.updatedAt) > Date.parse(r.updatedAt));
        return newer ?? r;
      }));
    } catch (e) { if (!request.signal.aborted) setError(readableError(e)); }
    finally { if (!request.signal.aborted) setLoading(false); }
  }, [uid, services]);
  useEffect(() => {
    activeUid.current = uid; setRequests([]); setNextCursor(null); setLoadingMore(false); setError(''); setUploadError('');
    controller.current?.abort(); controller.current = null; read.current?.abort(); setUploading(false);
    if (!uid) { setLoading(false); return; }
    void refresh();
    const unregister = services.auth.registerSignOutCleanup(() => { controller.current?.abort(); read.current?.abort(); activeUid.current = undefined; });
    return () => { controller.current?.abort(); read.current?.abort(); unregister(); };
  }, [uid, refresh, services]);
  useEffect(() => {
    if (services.mode !== 'connected' || !requests.some(r => ['reading', 'generating'].includes(r.status))) return;
    const interval = window.setInterval(() => { if (!controller.current) void refresh(); }, 5000);
    return () => window.clearInterval(interval);
  }, [services.mode, requests, refresh]);
  const loadMore = async () => {
    if (!uid || !nextCursor || !services.intake.listPage || loading || loadingMore) return;
    read.current?.abort(); const operation = new AbortController(); read.current = operation;
    setLoadingMore(true); setError('');
    try {
      const page = await services.intake.listPage(nextCursor, operation.signal);
      if (operation.signal.aborted || activeUid.current !== uid) return;
      page.requests.forEach(r => assertOwner(r, uid));
      setRequests(previous => [...previous, ...page.requests.filter(r => !previous.some(old => old.id === r.id))]);
      setNextCursor(page.nextCursor);
    } catch (e) { if (!operation.signal.aborted) setError(readableError(e)); }
    finally { if (!operation.signal.aborted) setLoadingMore(false); }
  };
  const upload = async (input: CreateIntake | CreateTextIntake, key: string) => {
    if (!uid || controller.current) throw new Error('An upload is already running or sign-in is required.');
    const operation = new AbortController(); controller.current = operation; setUploading(true); setUploadError('');
    try {
      const request = 'documents' in input
        ? await (services.intake.createText ? services.intake.createText(input, key, operation.signal) : Promise.reject(new Error('Text saving is not available in this build.')))
        : await services.intake.create(input, key, operation.signal);
      operation.signal.throwIfAborted();
      if (activeUid.current !== uid) throw new Error('Your account changed.');
      assertOwner(request, uid); upsert(request); return request;
    } catch (e) {
      if (activeUid.current === uid) setUploadError(operation.signal.aborted ? 'Upload stopped in this browser. The server may already have received it; refresh Library before retrying.' : readableError(e));
      throw e;
    } finally { if (controller.current === operation) { controller.current = null; setUploading(false); } }
  };
  return <Context.Provider value={{ requests, loading, error, refresh, hasMore: !!nextCursor, loadingMore, loadMore, upsert, uploading, uploadError, upload, cancelUpload: () => controller.current?.abort() }}>{children}</Context.Provider>;
}
export function useMaterials() { const context = useContext(Context); if (!context) throw new Error('Materials provider missing.'); return context; }
