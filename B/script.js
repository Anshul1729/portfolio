const chatWindow = document.getElementById('chat-window');
const inputArea = document.getElementById('input-area');
const menuDropdown = document.getElementById('menu-dropdown');

// Toggle Menu
function toggleMenu() {
    menuDropdown.classList.toggle('show');
}

// Close menu when clicking outside
window.onclick = function (event) {
    if (!event.target.matches('.menu-btn')) {
        if (menuDropdown.classList.contains('show')) {
            menuDropdown.classList.remove('show');
        }
    }
}

function handleMenuAction(action) {
    if (action === 'reset') {
        location.reload();
    } else if (action === 'contact') {
        runSequence('contact');
    }
}

const flow = {
    start: {
        messages: [
            "Booting system... Connected.",
            "Hello, guest. I am the digital terminal for Anshul Shivhare.",
            "Not just a coder. A Builder.",
            "He turns ideas into products that scale."
        ],
        options: [
            { label: "Who is Anshul?", next: "about" },
            { label: "Show me builds", next: "projects" },
            { label: "Vibe check", next: "vibe" },
            { label: "Contact", next: "contact" }
        ]
    },
    about: {
        messages: [
            "Anshul is a Builder, Operator, and Growth Generalist.",
            "He leverages AI and intuition to build powerful products fast.",
            "He built Kirana Club's Android app (0 to 5M+ installs) and a ₹100Cr+ marketplace.",
            "He doesn't just write lines of code; he ships outcomes. <span class='read-more' onclick='showExperience()'>[Read more]</span>"
        ],
        options: [
            { label: "See his builds", next: "projects" },
            { label: "How does he build?", next: "vibe" },
            { label: "Main Menu", next: "start" }
        ]
    },
    vibe: {
        messages: [
            "He builds products with the help of AI — speed and soul.",
            "Anshul uses modern tools to skip the boilerplate and focus on the user value.",
            "It's about shipping v1 in weeks, not months.",
            "Less syntax, more impact."
        ],
        options: [
            { label: "Show me the impact (Projects)", next: "projects" },
            { label: "Main Menu", next: "start" }
        ]
    },
    projects: {
        messages: [
            "Here are some featured builds:",
            `1. <a href="#" onclick="redirectWithLoading('https://securedocai.lovable.app'); return false;">SecureDoc AI ↗</a>: Chat with documents. (React, TS, Supabase)`,
            `2. <a href="#" onclick="redirectWithLoading('https://careers-roast.emergent.host/'); return false;">Roast Your LinkedIn ↗</a>: Viral AI voice roaster. (Python, TTS, LLM)`,
            `3. <a href="#" onclick="redirectWithLoading('https://svg-to-catalogue-generator.onrender.com/'); return false;">SVG Generator ↗</a>: Automated marketing asset creation.`
        ],
        options: [
            { label: "Back to About", next: "about" },
            { label: "Main Menu", next: "start" }
        ]
    },
    contact: {
        messages: [
            "Anshul is a Builder, Operator, and Growth Generalist.",
            "Ready to build something great?",
            "Email: <span id='email'>anshulshivhare3@gmail.com</span> <button class='copy-btn' onclick='copyEmail()'>Copy</button>"
        ],
        options: [
            { label: "LinkedIn", action: 'redirect', url: "https://linkedin.com/in/anshul-shivhare" },
            { label: "GitHub", action: 'redirect', url: "https://github.com/Anshul1729" },
            { label: "Main Menu", next: "start" }
        ]
    }
};

function typeMessage(text, callback) {
    const div = document.createElement('div');
    div.classList.add('message', 'bot');
    const content = document.createElement('div');
    content.classList.add('message-content');
    div.appendChild(content);
    chatWindow.appendChild(div);

    let i = 0;
    const speed = 15;

    // Handle HTML content immediately if present, else type effect
    if (text.includes('<') && text.includes('>')) {
        content.innerHTML = text; // Render HTML directly for links/spans working
        chatWindow.scrollTop = chatWindow.scrollHeight;
        if (callback) setTimeout(callback, 500);
    } else {
        function type() {
            if (i < text.length) {
                content.textContent += text.charAt(i);
                i++;
                chatWindow.scrollTop = chatWindow.scrollHeight;
                setTimeout(type, speed);
            } else {
                content.innerHTML = text
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\n/g, '<br>');
                if (callback) callback();
            }
        }
        type();
    }
}

async function showExperience() {
    const messages = [
        "Anshul was a key builder at **Kirana Club**, scaling the Android app from 0 to 5M+ installs.",
        "He also served as **Entrepreneur-in-Residence** at **Testbook**, impacting millions of users.",
        "His professional journey blends engineering depth with product intuition."
    ];

    // Remove "Read more" link to prevent re-clicking
    const readMoreLinks = document.querySelectorAll('.read-more');
    readMoreLinks.forEach(link => link.style.display = 'none');

    for (const msg of messages) {
        await new Promise(resolve => typeMessage(msg, resolve));
        await new Promise(resolve => setTimeout(resolve, 400));
    }

    showOptions([
        { label: "See his builds", next: "projects" },
        { label: "Main Menu", next: "start" }
    ]);
}

async function runSequence(key) {
    // Clear input
    inputArea.innerHTML = '';

    // Tiny delay for realism
    await new Promise(r => setTimeout(r, 200));

    const node = flow[key];

    for (const msg of node.messages) {
        await new Promise(resolve => typeMessage(msg, resolve));
        await new Promise(resolve => setTimeout(resolve, 400));
    }

    showOptions(node.options);
}

function showOptions(options) {
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.classList.add('option-chip');
        btn.textContent = opt.label;
        btn.onclick = () => handleSelection(opt);
        inputArea.appendChild(btn);
    });
}

async function handleSelection(option) {
    // User message bubble
    const userDiv = document.createElement('div');
    userDiv.classList.add('message', 'user');
    userDiv.textContent = option.label;
    chatWindow.appendChild(userDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    // Clear input immediately to prevent double clicks
    inputArea.innerHTML = '';

    if (option.action === 'redirect') {
        redirectWithLoading(option.url);
    } else if (option.next) {
        runSequence(option.next);
    }
}

// Helper: redirect with loading overlay
function redirectWithLoading(url) {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.add('show');
    overlay.innerHTML = '<div class="spinner"></div>';
    // simulate loading then open
    setTimeout(() => {
        window.open(url, '_blank');
        overlay.classList.remove('show');
        // Show main menu after redirect
        showOptions([{ label: "Main Menu", next: "start" }]);
    }, 1200);
}

// Helper: copy email to clipboard
function copyEmail() {
    const emailElem = document.getElementById('email');
    if (!emailElem) return;
    const email = emailElem.textContent;
    navigator.clipboard.writeText(email).then(() => {
        const toast = document.createElement('div');
        toast.textContent = 'Email copied!';
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.background = 'var(--accent-color)';
        toast.style.color = '#fff';
        toast.style.padding = '8px 12px';
        toast.style.borderRadius = '4px';
        toast.style.zIndex = '10000';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    });
}

// Start
runSequence('start');

