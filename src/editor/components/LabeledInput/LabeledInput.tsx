import { DetailedHTMLProps, InputHTMLAttributes } from 'react';

const LabeledInput = ({
  label,
  ...props
}: {
  label: React.ReactNode;
  labelWidth?: number;
} & DetailedHTMLProps<
  InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>) => {
  return (
    <div className="relative labeledInput">
      <label>{label}</label>
      <input {...props} className={`textinput ${props.className || ''}`} />
    </div>
  );
};

export default LabeledInput;
