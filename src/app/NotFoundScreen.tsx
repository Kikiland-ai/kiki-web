import { Link } from 'react-router'

export function NotFoundScreen() {
  return (
    <section>
      <h1>This page doesn't exist</h1>
      <p>
        <Link to="/home">Go to Home</Link>
      </p>
    </section>
  )
}
