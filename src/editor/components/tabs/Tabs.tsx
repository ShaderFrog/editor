import React, {
  HTMLAttributes,
  ReactNode,
  createContext,
  useContext,
} from 'react';
import classnames from 'classnames/bind';
import style from './tabs.module.css';
const cx = classnames.bind(style);

type TabContextType = {
  selectedClassName?: any;
  onTabSelect: (index: number) => void;
  selected: number;
};
type WithChildren<P> = P & { children?: ReactNode };

const TabContext = createContext<TabContextType | null>(null);

// Overall wrapping component
const Tabs = ({
  children,
  onTabSelect,
  selected,
  selectedClassName = 'tab_selected',
  ...props
}: HTMLAttributes<HTMLDivElement> & WithChildren<TabContextType>) => {
  return (
    <div {...props}>
      <TabContext.Provider
        value={{
          onTabSelect,
          selected,
          selectedClassName,
        }}
      >
        {children}
      </TabContext.Provider>
    </div>
  );
};

// Group of the tabs themselves
const TabGroup = ({
  className,
  children,
  ...props
}: WithChildren<{ className?: any }>) => {
  return (
    <div {...props} className={cx('tab_tabs', className)}>
      {React.Children.map<ReactNode, ReactNode>(
        children,
        (child, index) =>
          React.isValidElement(child) &&
          // Tell each <Tab> about its index
          React.cloneElement(child as React.ReactElement<{ index: number }>, {
            index,
          })
      )}
    </div>
  );
};

// An individual tab
const Tab = ({
  index,
  className,
  children,
  ...props
}: WithChildren<{
  className?: any;
  index?: number;
}>) => {
  const { selectedClassName, onTabSelect, selected } = useContext(
    TabContext
  ) as TabContextType;
  return (
    <div
      {...props}
      className={cx(className, 'tab_tab', {
        [selectedClassName]: selected === index,
      })}
      onClick={(event) => {
        event.preventDefault();
        onTabSelect && onTabSelect(index || 0);
      }}
    >
      {children}
    </div>
  );
};

// Wraps all panels, shows only the selected panel
const TabPanels = ({ children }: { children: React.ReactNode }) => {
  const { selected } = useContext(TabContext) as TabContextType;
  return (
    <>
      {React.Children.map<ReactNode, ReactNode>(children, (child, index) =>
        selected === index ? child : null
      )}
    </>
  );
};

// The contents for each tab. Just a thin wrapper around a div. I have no idea
// why forwardref is here lol
interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {}
const TabPanel = React.forwardRef<HTMLDivElement | null, TabPanelProps>(
  ({ children, ...props }, ref) => {
    return (
      <div ref={ref} {...props}>
        {children}
      </div>
    );
  }
);
TabPanel.displayName = 'TabPanel';

export { Tabs, Tab, TabGroup, TabPanels, TabPanel };
