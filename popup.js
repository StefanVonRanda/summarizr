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

const interogationPrompt = `
You are a helpful assistant that answers questions based on provided webpage content. Your input will include webpage text or raw HTML, followed by a user question.
Your task is to:
Understand and extract relevant information from the content.
Provide a clear, concise, and factual answer to the question.
Format the answer using valid inline HTML only (i.e., no <html>, <head>, or <body> tags).
Use appropriate HTML elements to enhance readability (e.g., <p>, <strong>, <ul>, <li>, <a> for links). If the answer references key points or details, consider using bullet points or bold highlights.
Do not include JavaScript, stylesheets, or external scripts.
If the answer is not found in the content, say so clearly in HTML format (e.g., <p><em>Sorry, the answer to this question is not available in the provided content.</em></p>).`;

async function interogate(content, text) {
  const payload = {
    model: 'any',
    messages: [
      { role: "system", content: interogationPrompt },
      { role: "user", content: `${text}.\n\n ${content}` }
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

const summaryPrompt = `
You are an expert web content summarizer. You will receive webpage data as input (either in plain text or raw HTML). Your task is to analyze the content and generate a concise, human-readable summary formatted as valid inline HTML.
Your output should be:
Structured with basic semantic HTML elements (e.g., <p>, <strong>, <ul>, <li>).
No <html>, <head>, or <body> tags—just the inline content.
No JavaScript or external styles.
Ideally limited to 2–4 short paragraphs or bullet points.
Focused on key topics, purpose, or notable elements of the webpage.
Make the summary informative and skimmable. If the page is product- or service-related, highlight core offerings and value propositions.`;

async function summarizeContent(text) {
  const payload = {
    model: "any",
    messages: [
      { role: "system", content: summaryPrompt },
      { role: "user", content: `Summarize the following webpage content and respond in html:\n\n${text}` }
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

const speakBtn = document.getElementById('ttsBtn');

speakBtn.addEventListener('click', () => {
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    return;
  }

  const summaryText = document.getElementById('summary').innerText;
  if (!summaryText) return;

  const utterance = new SpeechSynthesisUtterance(summaryText);
  utterance.rate = 1.5;

  speechSynthesis.speak(utterance);
});

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const tabKey = `summary_${tab.id}`;
  chrome.storage.local.set({ [tabKey]: summary });
});