import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import classnames from 'classnames';
import styles from './dropdown.module.css';

const cx = classnames.bind(styles);

type DropdownContextType = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  selectedValue?: string;
  onSelect: (value: string, content: React.ReactNode) => void;
  setSelectedContent: (content: React.ReactNode) => void;
};

const DropdownContext = React.createContext<DropdownContextType | undefined>(
  undefined
);

type DropdownProps = {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export const Dropdown: React.FC<DropdownProps> = ({
  value,
  onChange,
  children,
  placeholder = 'Select...',
  className,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<React.ReactNode>(
    () => {
      let content = null;
      React.Children.forEach(children, (child) => {
        if (
          React.isValidElement(child) &&
          'value' in child.props &&
          child.props.value === value
        ) {
          content = child.props.children;
        }
      });
      return content;
    }
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false);
    }
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    },
    [isOpen]
  );

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleClickOutside]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, handleKeyDown]);

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (value: string, content: React.ReactNode) => {
    onChange(value);
    setSelectedContent(content);
  };

  return (
    <DropdownContext.Provider
      value={{
        isOpen,
        setIsOpen,
        selectedValue: value,
        onSelect: handleSelect,
        setSelectedContent,
      }}
    >
      <div
        ref={dropdownRef}
        className={cx(
          styles.dropdownContainer,
          'select',
          {
            [styles.disabled]: disabled,
            [styles.open]: isOpen,
          },
          className
        )}
      >
        <div className={styles.dropdownHeader} onClick={toggleDropdown}>
          <span className={styles.selectedText}>
            {selectedContent || placeholder}
          </span>
          <FontAwesomeIcon
            icon={faChevronDown}
            className={cx(styles.arrow, { [styles.open]: isOpen })}
          />
        </div>
        {isOpen && (
          <ul className={cx('selectoptions', styles.optionsList)}>
            {children}
          </ul>
        )}
      </div>
    </DropdownContext.Provider>
  );
};

type DropdownHeaderProps = {
  children: React.ReactNode;
};

export const DropdownHeader: React.FC<DropdownHeaderProps> = ({ children }) => {
  return <li className={styles.header}>{children}</li>;
};

type DropdownOptionProps = {
  value: string;
  children: React.ReactNode;
  thumbnail?: string;
};

export const DropdownOption: React.FC<DropdownOptionProps> = ({
  value,
  children,
  thumbnail,
}) => {
  const context = React.useContext(DropdownContext);
  if (!context) {
    throw new Error('DropdownOption must be used within a Dropdown');
  }

  const { selectedValue, onSelect, setIsOpen } = context;

  useEffect(() => {
    if (selectedValue === value) {
      context.setSelectedContent(children);
    }
  }, [selectedValue, value, children, context]);

  const handleClick = () => {
    onSelect(value, children);
    setIsOpen(false);
  };

  return (
    <li
      className={cx(styles.option, {
        [styles.selected]: value === selectedValue,
        [styles.withThumbnail]: thumbnail,
      })}
      onClick={handleClick}
    >
      {thumbnail && (
        <img src={thumbnail} alt={value} className={styles.thumbnail} />
      )}
      <span className={styles.label}>{children}</span>
    </li>
  );
};
