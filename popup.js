document.getElementById('summarizeBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	document.getElementById('summarizeBtn').innerText = 'Thinking';
	document.getElementById('summarizeBtn').disabled = true;
	document.getElementById('summary').textContent = 'Summarizing...';

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: getPageContent,
  }, async (results) => {
    const content = results[0].result;
    const summary = await summarizeContent(content);
    document.getElementById('summary').innerHTML = parseMd(summary);
		document.getElementById('summarizeBtn').innerText = 'Summarize';
		document.getElementById('summarizeBtn').disabled = false;
  });
});

function getPageContent() {
  return document.body.innerText.slice(0, 4000); // Truncate for local models
}

function cleanModelOutput(text) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "") // removes <think>...</think>
    .replace(/\s{2,}/g, " ")                          // collapse extra whitespace
    .trim();
}

async function summarizeContent(text) {
  const payload = {
    model: "any", // or omit if LM Studio doesn’t require
    messages: [
      { role: "system", content: "You are a helpful assistant that summarizes text." },
      { role: "user", content: `Summarize the following:\n\n${text}` }
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

const parseMd = (md) => {
	//ul
	md = md.replace(/^\s*\n\*/gm, "<ul>\n*");
	md = md.replace(/^(\*.+)\s*\n([^\*])/gm, "$1\n</ul>\n\n$2");
	md = md.replace(/^\*(.+)/gm, "<li>$1</li>");

	//ol
	md = md.replace(/^\s*\n\d\./gm, "<ol>\n1.");
	md = md.replace(/^(\d\..+)\s*\n([^\d\.])/gm, "$1\n</ol>\n\n$2");
	md = md.replace(/^\d\.(.+)/gm, "<li>$1</li>");

	//blockquote
	md = md.replace(/^\>(.+)/gm, "<blockquote>$1</blockquote>");

	//h
	md = md.replace(/[\#]{6}(.+)/g, "<h6>$1</h6>");
	md = md.replace(/[\#]{5}(.+)/g, "<h5>$1</h5>");
	md = md.replace(/[\#]{4}(.+)/g, "<h4>$1</h4>");
	md = md.replace(/[\#]{3}(.+)/g, "<h3>$1</h3>");
	md = md.replace(/[\#]{2}(.+)/g, "<h2>$1</h2>");
	md = md.replace(/[\#]{1}(.+)/g, "<h1>$1</h1>");

	//alt h
	md = md.replace(/^(.+)\n\=+/gm, "$1<hr>");
	md = md.replace(/^(.+)\n\-+/gm, "$1<hr>");

	//images
	md = md.replace(/\!\[([^\]]+)\]\(([^\)]+)\)/g, '<img src="$2" alt="$1" />');

	//links
	md = md.replace(
		/[\[]{1}([^\]]+)[\]]{1}[\(]{1}([^\)\"]+)(\"(.+)\")?[\)]{1}/g,
		'<a href="$2" title="$4">$1</a>'
	);

	//font styles
	md = md.replace(/[\*\_]{2}([^\*\_]+)[\*\_]{2}/g, "<b>$1</b>");
	md = md.replace(/[\*\_]{1}([^\*\_]+)[\*\_]{1}/g, "<i>$1</i>");
	md = md.replace(/[\~]{2}([^\~]+)[\~]{2}/g, "<del>$1</del>");

	//pre
	md = md.replace(/^\s*\n\`\`\`(([^\s]+))?/gm, '<pre class="$2">');
	md = md.replace(/^\`\`\`\s*\n/gm, "</pre>\n\n");

	//code
	md = md.replace(/[\`]{1}([^\`]+)[\`]{1}/g, "<code>$1</code>");

	//p
	md = md.replace(/^\s*(\n)?(.+)/gm, (m) => {
		return /\<(\/)?(h\d|ul|ol|li|blockquote|pre|img)/.test(m)
			? m
			: "<p>" + m + "</p>";
	});

	//strip p from pre
	md = md.replace(/(\<pre.+\>)\s*\n\<p\>(.+)\<\/p\>/gm, "$1$2");

	return md;
};