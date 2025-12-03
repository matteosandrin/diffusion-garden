import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type TextareaHTMLAttributes,
} from "react";

interface AutoResizeTextareaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "onChange"
> {
  value: string;
  onChange: (value: string) => void;
  minHeight?: string;
  maxHeight?: string;
  height?: string;
}

export function AutoResizeTextarea({
  value,
  onChange,
  minHeight = "60px",
  maxHeight = "200px",
  height,
  className = "",
  style,
  ...props
}: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Local state to prevent cursor reset on typing
  const [localValue, setLocalValue] = useState(value);

  // Sync from external value to local state (when value changes externally)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Auto-resize textarea
  useEffect(() => {
    if (!height && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [localValue, height]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue); // Update local state immediately (no cursor jump)
      onChange(newValue); // Notify parent
    },
    [onChange],
  );

  return (
    <textarea
      ref={textareaRef}
      value={localValue}
      onChange={handleChange}
      className={`w-full bg-transparent resize-none outline-none pr-1 ${className}`}
      style={{
        ...(height ? { height } : { minHeight, maxHeight }),
        ...style,
      }}
      {...props}
    />
  );
}
