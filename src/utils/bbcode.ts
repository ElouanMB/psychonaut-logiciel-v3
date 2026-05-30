/**
 * A simple regex-based BBCode to HTML converter.
 */
export function parseBBCode(text: string): string {
  if (!text) return "";

  // Escape HTML entities to prevent XSS in preview
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold
  html = html.replace(/\[B\]([\s\S]*?)\[\/B\]/gi, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\[I\]([\s\S]*?)\[\/I\]/gi, "<em>$1</em>");

  // Underline
  html = html.replace(/\[U\]([\s\S]*?)\[\/U\]/gi, "<u>$1</u>");

  // Color [COLOR=#hex]text[/COLOR] or [COLOR=name]text[/COLOR]
  html = html.replace(
    /\[COLOR=([^\]]+)\]([\s\S]*?)\[\/COLOR\]/gi,
    '<span style="color: $1">$2</span>'
  );

  // Quote [QUOTE]text[/QUOTE]
  html = html.replace(
    /\[QUOTE\]([\s\S]*?)\[\/QUOTE\]/gi,
    '<blockquote class="border-l-4 border-accent bg-sidebar-bg/50 px-4 py-2 my-4 rounded-r-md italic text-fg-muted font-sans">$1</blockquote>'
  );

  // URL with custom text [URL=http://...]text[/URL]
  html = html.replace(
    /\[URL=([^\]]+)\]([\s\S]*?)\[\/URL\]/gi,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline font-semibold">$2</a>'
  );

  // URL [URL]http://...[/URL]
  html = html.replace(
    /\[URL\]([\s\S]*?)\[\/URL\]/gi,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline font-semibold">$1</a>'
  );

  // List [LIST]...[/LIST]
  html = html.replace(
    /\[LIST\]([\s\S]*?)\[\/LIST\]/gi,
    '<ul class="list-disc pl-5 my-2 space-y-1">$1</ul>'
  );

  // List item [*]
  // First match [*] inside list and wrap line content
  html = html.replace(/\[\*\](.*?)(\n|(?=\[\*\])|(?=\[\/LIST\]))/gi, "<li>$1</li>");

  // Code [CODE]text[/CODE]
  html = html.replace(
    /\[CODE\]([\s\S]*?)\[\/CODE\]/gi,
    '<pre class="bg-sidebar-bg p-3 rounded-md font-mono text-sm border border-border-main my-2 overflow-x-auto">$1</pre>'
  );

  // Convert newlines to <br /> (but avoid double adding inside lists or blocks where not needed)
  html = html.replace(/\n/g, "<br />");

  return html;
}
