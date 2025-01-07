import { SWRConfig } from 'swr';

function withSWR<T extends unknown>(
  WrappedComponent: React.ComponentType<T>,
  fallback?: any
) {
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || 'withSWRWrapper';

  const InnerComponent = (props: T & { fallback: any }) => {
    return (
      <SWRConfig value={{ fallback: fallback || props.fallback }}>
        <WrappedComponent {...props} />
      </SWRConfig>
    );
  };

  InnerComponent.displayName = `withSWR(${displayName})`;

  return InnerComponent;
}

export default withSWR;
