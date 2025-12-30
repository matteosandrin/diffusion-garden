import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
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
  autoScrollToBottom?: boolean;
}

export interface AutoResizeTextareaRef {
  focus: () => void;
}

export const AutoResizeTextarea = forwardRef<
  AutoResizeTextareaRef,
  AutoResizeTextareaProps
>(function AutoResizeTextarea(
  {
    value,
    onChange,
    minHeight = "60px",
    maxHeight = "200px",
    height,
    autoScrollToBottom = false,
    className = "",
    style,
    ...props
  },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const userHasInteractedRef = useRef(false);
  const isAutoScrollingRef = useRef(false);
  const previousValueRef = useRef(value);

  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus();
    },
  }));

  // Local state to prevent cursor reset on typing
  const [localValue, setLocalValue] = useState(value);

  // Sync from external value to local state (when value changes externally)
  useEffect(() => {
    const valueChangedExternally = previousValueRef.current !== value;
    const previousValue = previousValueRef.current;
    previousValueRef.current = value;
    setLocalValue(value);

    // Reset interaction flag when content is cleared (new run starting)
    if (valueChangedExternally && previousValue && !value) {
      userHasInteractedRef.current = false;
    }

    // Auto-scroll to bottom when value changes externally and feature is enabled
    if (
      autoScrollToBottom &&
      valueChangedExternally &&
      !userHasInteractedRef.current &&
      textareaRef.current
    ) {
      isAutoScrollingRef.current = true;
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      // Reset flag after scroll completes
      requestAnimationFrame(() => {
        isAutoScrollingRef.current = false;
      });
    }
  }, [value, autoScrollToBottom]);

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
      // User typing is considered interaction
      userHasInteractedRef.current = true;
    },
    [onChange],
  );

  const handleScroll = useCallback(() => {
    if (!isAutoScrollingRef.current && textareaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = textareaRef.current;
      // If user scrolled away from bottom, mark as interacted
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
      if (!isAtBottom) {
        userHasInteractedRef.current = true;
      }
    }
  }, []);

  const handleUserInteraction = useCallback(() => {
    userHasInteractedRef.current = true;
  }, []);

  return (
    <textarea
      ref={textareaRef}
      value={localValue}
      onChange={handleChange}
      onScroll={handleScroll}
      onClick={handleUserInteraction}
      onFocus={handleUserInteraction}
      onKeyDown={handleUserInteraction}
      className={`w-full bg-transparent resize-none outline-none pr-1 ${className}`}
      style={{
        ...(height ? { height } : { minHeight, maxHeight }),
        ...style,
      }}
      {...props}
    />
  );
});
