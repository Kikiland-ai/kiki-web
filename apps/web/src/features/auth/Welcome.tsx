import { Navigate } from 'react-router';
import { useSession } from '../../app/Session';
import { onboardingComplete } from '../../contracts/profile';
import { Landing } from '../landing/Landing';

export function Welcome() {
  const { profile } = useSession();
  if (profile) return <Navigate to={onboardingComplete(profile) ? '/home' : '/onboarding'} replace />;
  return <Landing />;
}
