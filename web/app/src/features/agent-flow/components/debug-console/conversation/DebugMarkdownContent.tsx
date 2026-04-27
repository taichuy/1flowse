import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

export function DebugMarkdownContent({
  content,
  className
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        disallowedElements={['iframe', 'script', 'style', 'link', 'meta', 'object', 'embed']}
        unwrapDisallowed
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
