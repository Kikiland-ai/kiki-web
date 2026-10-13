type Props = { title: string; owner: 'Akshita' | 'Arpan'; note?: string }

/** Stand-in for a screen that its owner has not built yet. */
export function PlaceholderScreen({ title, owner, note }: Props) {
  return (
    <section>
      <h1>{title}</h1>
      <p>Not built yet. Owner: {owner}.</p>
      {note && <p>{note}</p>}
    </section>
  )
}
