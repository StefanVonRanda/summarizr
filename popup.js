document.getElementById('summarizeBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (document.getElementById('summarizeBtn').innerText === 'Summarize') {
    document.getElementById('summarizeBtn').innerText = 'Thinking';
    document.getElementById('summarizeBtn').disabled = true;
    document.getElementById('summary').textContent = 'Summarizing...';

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: getPageContent,
    }, async (results) => {

      const content = results[0].result + ' /no_think';
      const summary = await summarizeContent(content);
      document.getElementById('summary').innerHTML = summary.replace('```html','').replace('```','');

      document.getElementById('summarizeBtn').innerText = 'Find out more';
      document.getElementById('summarizeBtn').disabled = false;
      document.getElementById('interogate').hidden = false;
    });
  } else if (document.getElementById('summarizeBtn').innerText === 'Find out more') {
    document.getElementById('summarizeBtn').innerText = 'Find out more';
    document.getElementById('summarizeBtn').disabled = true;
    document.getElementById('summary').textContent = 'Researching...';

    const text = document.getElementById('interogate').value;

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: getPageContent,
    }, async (results) => {

      const content = results[0].result + ' /no_think';
      const summary = await interogate(content, text);
      document.getElementById('summary').innerHTML = summary.replace('```html','').replace('```','');

      document.getElementById('summarizeBtn').innerText = 'Find out more';
      document.getElementById('summarizeBtn').disabled = false;
      document.getElementById('interogate').hidden = false;
    });

    interogate(document.getElementById('interogate').value);
  }
});

window.addEventListener('load', async () => {
  await checkLMStudioConnection();
});

async function getModelName() {
  const response = await fetch('http://127.0.0.1:1234/v1/models', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer not-needed'
    }
  }
  );

  const data = await response.json();
  document.getElementById('status').textContent = 'Connected to ' + data.data[0].id;
}

async function checkLMStudioConnection() {
  try {
    const response = await fetch('http://localhost:1234/', {
      method: 'GET',
    });

    if (response.ok) {
      document.getElementById('status').classList.add('sucess');
      getModelName();
    } else {
      document.getElementById('status').classList.add('fail');
      document.getElementById('status').textContent = 'Could not connect to LM Studio';
    }
  } catch (error) {
    document.getElementById('status').classList.add('fail');
    document.getElementById('status').textContent = 'Could not connect to LM Studio';
  }
}

function getPageContent() {
  return document.body.innerText.slice(0, 4000);
}

function cleanModelOutput(text) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function interogate(content, text) {
  const payload = {
    model: 'any',
    messages: [
      { role: "system", content: "You are a helpful assistant that answers questions about webpage content. You respond in html only. Don't include" },
      { role: "user", content: `${text}. base your answer off the this webpage content:\n\n${content}` }
    ],
    temperature: 0.7
  };

  try {
    const response = await fetch("http://localhost:1234/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    const rawOutput = data.choices[0].message.content;
    return cleanModelOutput(rawOutput);

  } catch (err) {
    console.error("Fetch error:", err);
    return "Error communicating with LM Studio.";
  }
}

async function summarizeContent(text) {
  const payload = {
    model: "any",
    messages: [
      { role: "system", content: "You are a helpful assistant that summarizes webpage content. You respond in html only. Don't include" },
      { role: "user", content: `Summarize the following webpage content:\n\n${text}` }
    ],
    temperature: 0.7
  };

  try {
    const response = await fetch("http://localhost:1234/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    const rawOutput = data.choices[0].message.content;
    return cleanModelOutput(rawOutput);

  } catch (err) {
    console.error("Fetch error:", err);
    return "Error communicating with LM Studio.";
  }
}

class MarkdownParser {
  constructor() {
    // Define regex patterns for Markdown elements
    this.patterns = {
      // Headers
      headers: /^(#{1,6})\s+(.*?)$/gm,

      // Bold
      bold: /\*\*(.*?)\*\*/g,

      // Italic
      italic: /\*(.*?)\*/g,

      // Code blocks
      codeBlocks: /```([a-z]*)\n([\s\S]*?)\n```/g,

      // Inline code
      inlineCode: /`(.*?)`/g,

      // Links
      links: /\[(.*?)\]\((.*?)\)/g,

      // Images
      images: /!\[(.*?)\]\((.*?)\)/g,

      // Unordered lists
      unorderedLists: /^[*+-]\s+(.*?)$/gm,

      // Ordered lists
      orderedLists: /^(\d+)\.\s+(.*?)$/gm,

      // Blockquotes
      blockquotes: /^>\s+(.*?)$/gm,

      // Horizontal rules
      horizontalRules: /^(?:[-*_]\s*){3,}$/gm,

      // Paragraphs (needs special handling)
      paragraphs: /^(?!<h|<ul|<ol|<blockquote|<hr|<pre|$)(.+)(?:\n|$)/gm
    };
  }

  /**
   * Parse markdown text to HTML
   * @param {string} markdown - The markdown text to parse
   * @return {string} The resulting HTML
   */
  parse(markdown) {
    // Add newlines to help with regex matching
    let html = '\n' + markdown + '\n';

    // Process code blocks first to avoid processing markdown inside them
    html = this.parseCodeBlocks(html);

    // Process the rest of the elements
    html = this.parseHeaders(html);
    html = this.parseBold(html);
    html = this.parseItalic(html);
    html = this.parseInlineCode(html);
    html = this.parseLinks(html);
    html = this.parseImages(html);
    html = this.parseUnorderedLists(html);
    html = this.parseOrderedLists(html);
    html = this.parseBlockquotes(html);
    html = this.parseHorizontalRules(html);

    // Process paragraphs last
    html = this.parseParagraphs(html);

    // Clean up any extra newlines
    html = html.trim();

    return html;
  }

  parseHeaders(text) {
    return text.replace(this.patterns.headers, (match, level, content) => {
      const headerLevel = level.length;
      return `<h${headerLevel}>${content.trim()}</h${headerLevel}>`;
    });
  }

  parseBold(text) {
    return text.replace(this.patterns.bold, (match, content) => {
      return `<strong>${content}</strong>`;
    });
  }

  parseItalic(text) {
    return text.replace(this.patterns.italic, (match, content) => {
      return `<em>${content}</em>`;
    });
  }

  parseCodeBlocks(text) {
    return text.replace(this.patterns.codeBlocks, (match, language, content) => {
      const languageClass = language ? ` class="language-${language}"` : '';
      return `<pre><code${languageClass}>${this.escapeHtml(content)}</code></pre>`;
    });
  }

  parseInlineCode(text) {
    return text.replace(this.patterns.inlineCode, (match, content) => {
      return `<code>${this.escapeHtml(content)}</code>`;
    });
  }

  parseLinks(text) {
    return text.replace(this.patterns.links, (match, text, url) => {
      return `<a href="${url}">${text}</a>`;
    });
  }

  parseImages(text) {
    return text.replace(this.patterns.images, (match, alt, url) => {
      return `<img src="${url}" alt="${alt}">`;
    });
  }

  parseUnorderedLists(text) {
    // First, identify groups of list items
    const groups = text.match(/(?:^[*+-]\s+.*$\n?)+/gm);

    if (!groups) return text;

    for (const group of groups) {
      // Create a list with all items
      const items = group.match(/^[*+-]\s+(.*?)$/gm).map(item => {
        const content = item.replace(/^[*+-]\s+/, '');
        return `<li>${content}</li>`;
      }).join('');

      const list = `<ul>${items}</ul>`;

      // Replace the group with the formatted list
      text = text.replace(group, list);
    }

    return text;
  }

  parseOrderedLists(text) {
    // First, identify groups of list items
    const groups = text.match(/(?:^\d+\.\s+.*$\n?)+/gm);

    if (!groups) return text;

    for (const group of groups) {
      // Create a list with all items
      const items = group.match(/^\d+\.\s+(.*?)$/gm).map(item => {
        const content = item.replace(/^\d+\.\s+/, '');
        return `<li>${content}</li>`;
      }).join('');

      const list = `<ol>${items}</ol>`;

      // Replace the group with the formatted list
      text = text.replace(group, list);
    }

    return text;
  }

  parseBlockquotes(text) {
    // First, identify groups of blockquote lines
    const groups = text.match(/(?:^>\s+.*$\n?)+/gm);

    if (!groups) return text;

    for (const group of groups) {
      // Create a blockquote with all content
      const content = group.replace(/^>\s+/gm, '');
      const blockquote = `<blockquote>${content}</blockquote>`;

      // Replace the group with the formatted blockquote
      text = text.replace(group, blockquote);
    }

    return text;
  }

  parseHorizontalRules(text) {
    return text.replace(this.patterns.horizontalRules, () => {
      return '<hr>';
    });
  }

  parseParagraphs(text) {
    // We need to handle paragraphs carefully to avoid wrapping other elements
    const lines = text.split('\n');
    let inParagraph = false;
    let result = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines and lines that are already part of HTML elements
      if (line.trim() === '' || line.match(/^<\/?(\w+).*>$/)) {
        if (inParagraph) {
          result.push('</p>');
          inParagraph = false;
        }
        result.push(line);
        continue;
      }

      // If we're not already in a paragraph and the line isn't part of any Markdown element
      // that we've already processed, start a new paragraph
      if (!inParagraph && !line.match(/^<(\w+).*>$/)) {
        result.push('<p>');
        inParagraph = true;
      }

      result.push(line);

      // If the next line is empty or an HTML element, end the paragraph
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine.trim() === '' || nextLine.match(/^<(\w+).*>$/)) {
          if (inParagraph) {
            result.push('</p>');
            inParagraph = false;
          }
        }
      }
    }

    if (inParagraph) {
      result.push('</p>');
    }

    return result.join('\n');
  }

  /**
   * Escape HTML characters in code blocks
   * @param {string} text - The text to escape
   * @return {string} Escaped text
   */
  escapeHtml(text) {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };

    return text.replace(/[&<>"']/g, match => escapeMap[match]);
  }
}

// Example usage
function convertMarkdownToHtml(markdownText) {
  const parser = new MarkdownParser();
  return parser.parse(markdownText);
}