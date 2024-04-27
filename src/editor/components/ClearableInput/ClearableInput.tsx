/* eslint-disable @next/next/no-img-element */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleXmark } from '@fortawesome/free-solid-svg-icons';

const ClearableInput = ({
  value,
  onChange,
  onClear,
  placeholder,
  tooltip,
}: {
  value: string;
  onChange: (newValue: string) => void;
  onClear?: () => void;
  placeholder?: string;
  tooltip?: string;
}) => {
  return (
    <div className="relative clearable">
      <input
        type="text"
        className="textinput"
        placeholder={placeholder}
        // If value is undefined, it doesn't clear the input. This might be
        // related to the double rendering caused by the ConfigEditor also
        // updating the graph which causes a whole tree re-render
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onKeyUp={(e) => {
          if (e.key === 'Escape') {
            onClear ? onClear() : onChange('');
          }
        }}
      />
      {value !== null && value !== undefined && value !== '' ? (
        <FontAwesomeIcon
          className="clear"
          title={tooltip || 'Clear'}
          icon={faCircleXmark}
          onClick={() => {
            onClear ? onClear() : onChange('');
          }}
        />
      ) : null}
    </div>
  );
};

export default ClearableInput;
