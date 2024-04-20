/* eslint-disable @next/next/no-img-element */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleXmark,
  faMagnifyingGlass,
} from '@fortawesome/free-solid-svg-icons';

const SearchBox = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
}) => {
  return (
    <div className="searchwrap">
      <FontAwesomeIcon icon={faMagnifyingGlass} />
      <input
        type="text"
        className="textinput searchinput"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyUp={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
          }
          if (e.key === 'Escape') {
            onChange('');
          }
        }}
      />
      {value ? (
        <FontAwesomeIcon
          className="clearSearch"
          title="Clear filter"
          icon={faCircleXmark}
          onClick={(e) => {
            onChange('');
          }}
        />
      ) : null}
    </div>
  );
};

export default SearchBox;
