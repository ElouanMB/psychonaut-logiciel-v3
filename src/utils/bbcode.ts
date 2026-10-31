/**
 * A simple regex-based BBCode to HTML converter.
 */
export function parseBBCode(text: string): string {
  if (!text) return "";

  // Escape HTML entities to prevent XSS in preview (quotes too: values end up inside attributes)
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  // Strip optional quotes around tag values: [URL='...'] / [COLOR="..."]
  const unquote = (v: string) => v.trim().replace(/^(&quot;|')(.*)(&quot;|')$/, "$2");
  const safeUrl = (v: string) => {
    const url = unquote(v);
    return /^(https?:\/\/|mailto:)/i.test(url) ? url : "#";
  };
  const safeColor = (v: string) => {
    const color = unquote(v);
    return /^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d\s,.%]+\))$/i.test(color) ? color : "inherit";
  };

  // Bold
  html = html.replace(/\[B\]([\s\S]*?)\[\/B\]/gi, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\[I\]([\s\S]*?)\[\/I\]/gi, "<em>$1</em>");

  // Underline
  html = html.replace(/\[U\]([\s\S]*?)\[\/U\]/gi, "<u>$1</u>");

  // Color [COLOR=#hex]text[/COLOR] or [COLOR=name]text[/COLOR]
  html = html.replace(
    /\[COLOR=([^\]]+)\]([\s\S]*?)\[\/COLOR\]/gi,
    (_m, color: string, inner: string) => `<span style="color: ${safeColor(color)}">${inner}</span>`
  );

  // Quote [QUOTE]text[/QUOTE]
  html = html.replace(
    /\[QUOTE\]([\s\S]*?)\[\/QUOTE\]/gi,
    '<blockquote class="border-l-4 border-accent bg-sidebar-bg/50 px-4 py-2 my-4 rounded-r-md italic text-fg-muted font-sans">$1</blockquote>'
  );

  // URL with custom text [URL=http://...]text[/URL]
  html = html.replace(
    /\[URL=([^\]]+)\]([\s\S]*?)\[\/URL\]/gi,
    (_m, url: string, label: string) =>
      `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline font-semibold">${label}</a>`
  );

  // URL [URL]http://...[/URL]
  html = html.replace(
    /\[URL\]([\s\S]*?)\[\/URL\]/gi,
    (_m, url: string) =>
      `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline font-semibold">${url}</a>`
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
