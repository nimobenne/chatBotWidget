import AutoDemoClient from './AutoDemoClient';

export default function AutoDemoPage({ searchParams }: { searchParams: { biz?: string } }) {
  return <AutoDemoClient businessId={searchParams.biz || 'examplebarber'} />;
}
