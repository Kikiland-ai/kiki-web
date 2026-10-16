import { ActionLink, Card, Icon, PageTitle } from '../ui/kit';
export function FeatureBoundary({ title, description, icon }: { title: string; description: string; icon: string }) {
  return <div className="page-stack"><PageTitle eyebrow="COMING IN THE NEXT BUILD" title={title}>{description}</PageTitle><Card className="feature-boundary"><span className="boundary-icon"><Icon name={icon} /></span><h2>This part of Kiki is being prepared.</h2><p>Your account preferences and subject remain saved. You can return home or change your learning preferences.</p><div className="form-actions"><ActionLink to="/home">Back to home<Icon name="arrow_forward" /></ActionLink><ActionLink to="/profile" variant="secondary">My preferences</ActionLink></div></Card></div>;
}
