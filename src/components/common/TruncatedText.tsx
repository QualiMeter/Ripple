interface TruncatedTextProps {
    text: string
    className?: string
}

export function TruncatedText({
                                  text,
                                  className = '',
                              }: TruncatedTextProps) {
    return (
        <span
            className={`block min-w-0 truncate ${className}`}
            title={text}
        >
      {text}
    </span>
    )
}