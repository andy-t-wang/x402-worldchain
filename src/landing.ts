export const landingPageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AgentVid — Human-Backed Agents in Action</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}

    :root {
      --bg: #0a0a0a;
      --surface: #111111;
      --surface-2: #1a1a1a;
      --border: #222222;
      --border-light: #333333;
      --text: #e8e8e8;
      --text-dim: #888888;
      --text-muted: #555555;
      --accent: #9bf0e1;
      --accent-dim: rgba(155, 240, 225, 0.15);
      --accent-glow: rgba(155, 240, 225, 0.08);
      --orb-1: #1a2a3a;
      --orb-2: #0d1f2d;
      --font-display: 'DM Sans', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    html {
      scroll-behavior: smooth;
      background: var(--bg);
      color: var(--text);
    }

    body {
      font-family: var(--font-mono);
      font-size: 14px;
      line-height: 1.7;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }

    .orb-bg {
      position: fixed;
      inset: 0;
      z-index: -1;
      overflow: hidden;
    }

    .orb-bg::before {
      content: '';
      position: absolute;
      width: 800px;
      height: 800px;
      top: -200px;
      right: -200px;
      border-radius: 50%;
      background: radial-gradient(circle, var(--orb-1) 0%, transparent 70%);
      animation: orb-drift 20s ease-in-out infinite alternate;
    }

    .orb-bg::after {
      content: '';
      position: absolute;
      width: 600px;
      height: 600px;
      bottom: -100px;
      left: -150px;
      border-radius: 50%;
      background: radial-gradient(circle, var(--orb-2) 0%, transparent 70%);
      animation: orb-drift 25s ease-in-out infinite alternate-reverse;
    }

    @keyframes orb-drift {
      0% { transform: translate(0, 0) scale(1); }
      100% { transform: translate(40px, -30px) scale(1.1); }
    }

    .iris-ring {
      position: absolute;
      border-radius: 50%;
      border: 1px solid var(--border);
      pointer-events: none;
    }

    .iris-ring--1 {
      width: 500px; height: 500px;
      top: 10vh; right: -120px;
      opacity: 0.3;
      animation: ring-pulse 8s ease-in-out infinite;
    }

    .iris-ring--2 {
      width: 350px; height: 350px;
      top: calc(10vh + 75px); right: -45px;
      opacity: 0.2;
      animation: ring-pulse 8s ease-in-out 1s infinite;
    }

    .iris-ring--3 {
      width: 200px; height: 200px;
      top: calc(10vh + 150px); right: 30px;
      opacity: 0.15;
      animation: ring-pulse 8s ease-in-out 2s infinite;
    }

    @keyframes ring-pulse {
      0%, 100% { transform: scale(1); opacity: 0.3; }
      50% { transform: scale(1.03); opacity: 0.15; }
    }

    .container {
      max-width: 860px;
      margin: 0 auto;
      padding: 0 24px;
    }

    nav {
      padding: 24px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      z-index: 10;
    }

    .logo {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 18px;
      letter-spacing: -0.02em;
      color: var(--text);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .logo-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 12px var(--accent);
    }

    .nav-links {
      display: flex;
      gap: 28px;
      list-style: none;
    }

    .nav-links a {
      font-family: var(--font-display);
      color: var(--text-dim);
      text-decoration: none;
      font-size: 13px;
      transition: color 0.2s;
    }

    .nav-links a:hover { color: var(--accent); }

    .hero {
      padding: 100px 0 80px;
      position: relative;
    }

    .hero-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 100px;
      border: 1px solid var(--border);
      background: var(--surface);
      font-size: 12px;
      color: var(--text-dim);
      margin-bottom: 32px;
      animation: fade-up 0.8s ease both;
    }

    .hero-label .dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--accent);
    }

    .hero h1 {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: clamp(34px, 4.5vw, 52px);
      line-height: 1.25;
      letter-spacing: -0.025em;
      color: var(--text);
      max-width: 600px;
      animation: fade-up 0.8s 0.1s ease both;
    }

    .hero h1 em {
      font-style: normal;
      color: var(--accent);
      position: relative;
    }

    .hero-sub {
      margin-top: 24px;
      font-family: var(--font-display);
      font-weight: 400;
      font-size: 17px;
      line-height: 1.6;
      color: var(--text-dim);
      max-width: 500px;
      animation: fade-up 0.8s 0.2s ease both;
    }

    .hero-actions {
      margin-top: 40px;
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      animation: fade-up 0.8s 0.3s ease both;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: var(--font-mono);
      font-size: 13px;
      text-decoration: none;
      transition: all 0.25s;
      cursor: pointer;
      border: none;
    }

    .btn--primary {
      background: var(--accent);
      color: #0a0a0a;
      font-weight: 700;
    }

    .btn--primary:hover {
      box-shadow: 0 0 30px rgba(155, 240, 225, 0.3);
      transform: translateY(-1px);
    }

    .btn--ghost {
      background: transparent;
      color: var(--text-dim);
      border: 1px solid var(--border-light);
    }

    .btn--ghost:hover {
      color: var(--text);
      border-color: var(--text-muted);
    }

    .btn svg { width: 14px; height: 14px; flex-shrink: 0; }

    .pricing-strip {
      margin-top: 64px;
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
      animation: fade-up 0.8s 0.4s ease both;
    }

    .pricing-card {
      padding: 20px 24px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: var(--surface);
      flex: 1;
      min-width: 220px;
    }

    .pricing-card h3 {
      font-family: var(--font-display);
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 6px;
      color: var(--text);
    }

    .pricing-card p {
      font-family: var(--font-display);
      font-size: 13px;
      color: var(--text-dim);
      line-height: 1.5;
    }

    .pricing-card .price {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 28px;
      color: var(--accent);
      margin-top: 10px;
      letter-spacing: -0.02em;
    }

    .pricing-card--free {
      border-color: rgba(155, 240, 225, 0.2);
      background: linear-gradient(135deg, var(--accent-glow), transparent 60%);
    }

    .try-section {
      padding: 80px 0 100px;
    }

    .section-label {
      font-family: var(--font-display);
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--accent);
      margin-bottom: 12px;
    }

    .section-title {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: clamp(24px, 3.5vw, 34px);
      letter-spacing: -0.02em;
      color: var(--text);
      margin-bottom: 16px;
    }

    .section-desc {
      font-family: var(--font-display);
      color: var(--text-dim);
      font-size: 15px;
      line-height: 1.6;
      max-width: 520px;
      margin-bottom: 32px;
    }

    .prompt-block {
      position: relative;
      background: var(--surface);
      border: 1px solid rgba(155, 240, 225, 0.15);
      border-radius: 10px;
      padding: 16px 20px;
      padding-right: 70px;
      font-family: var(--font-display);
      font-size: 15px;
      line-height: 1.6;
      color: var(--text);
      max-width: 600px;
    }

    .prompt-block .copy-btn {
      top: 12px;
      right: 12px;
    }

    .code-block {
      position: relative;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 14px;
      padding-right: 70px;
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.5;
      color: var(--text-dim);
      overflow-x: auto;
      white-space: pre;
    }

    .code-block code {
      color: var(--text);
    }

    .copy-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 10px;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-dim);
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .copy-btn:hover {
      color: var(--accent);
      border-color: var(--accent);
    }

    .copy-btn.copied {
      color: var(--accent);
      border-color: var(--accent);
    }

    .step-label {
      font-family: var(--font-display);
      font-weight: 600;
      font-size: 15px;
      color: var(--text);
      margin-bottom: 8px;
    }

    .divider {
      height: 1px;
      background: linear-gradient(to right, transparent, var(--border), transparent);
      margin: 0;
    }

    footer {
      padding: 40px 0;
      text-align: center;
      font-family: var(--font-display);
      font-size: 13px;
      color: var(--text-muted);
    }

    footer a {
      color: var(--text-dim);
      text-decoration: none;
      transition: color 0.2s;
    }

    footer a:hover { color: var(--accent); }

    @keyframes fade-up {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .reveal {
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.6s ease, transform 0.6s ease;
    }

    .reveal.visible {
      opacity: 1;
      transform: translateY(0);
    }

    @media (max-width: 640px) {
      .hero { padding: 60px 0 60px; }
      .nav-links { display: none; }
      .pricing-strip { flex-direction: column; }
      .iris-ring { display: none; }
    }
  </style>
</head>
<body>
  <div class="orb-bg"></div>

  <div class="container" style="position:relative;">
    <div class="iris-ring iris-ring--1"></div>
    <div class="iris-ring iris-ring--2"></div>
    <div class="iris-ring iris-ring--3"></div>

    <nav>
      <a href="/" class="logo">
        <span class="logo-dot"></span>
        AgentVid
      </a>
      <ul class="nav-links">
        <li><a href="#get-started">Get Started</a></li>
        <li><a href="https://docs.world.org/agents/agent-kit" target="_blank" rel="noopener">AgentKit Docs</a></li>
        <li><a href="https://github.com/andy-t-wang/x402-worldchain" target="_blank" rel="noopener">GitHub</a></li>
      </ul>
    </nav>

    <section class="hero">
      <div class="hero-label">
        <span class="dot"></span>
        Human-backed agents, real actions
      </div>
      <h1>See human-backed agents <em>in action</em></h1>
      <p class="hero-sub">
        Your agent knows you from your conversations together. Let it imagine a day in your life&nbsp;&mdash; generated as a 10-second TikTok-style video with voiceover, powered by World&nbsp;ID.
      </p>
      <div class="hero-actions">
        <a href="#get-started" class="btn btn--primary">
          Get Started
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>
        <a href="https://docs.world.org/agents/agent-kit" target="_blank" rel="noopener" class="btn btn--ghost">
          AgentKit Docs
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
        </a>
      </div>

      <div class="pricing-strip">
        <div class="pricing-card pricing-card--free">
          <h3>Human-Backed</h3>
          <p>Verified with World&nbsp;ID via AgentBook</p>
          <div class="price">Free</div>
        </div>
        <div class="pricing-card">
          <h3>Unverified</h3>
          <p>Pay per generation via x402 on World&nbsp;Chain</p>
          <div class="price">$0.55</div>
        </div>
      </div>
    </section>

    <div class="divider"></div>

    <section class="try-section" id="get-started">
      <div class="section-label reveal">Try it</div>
      <h2 class="section-title reveal">Three steps to your video</h2>

      <div class="step reveal" style="margin-bottom:28px;">
        <p class="step-label">Step 1 &mdash; Install the skill</p>
        <p class="section-desc" style="margin-bottom:12px;">Run this in your terminal to give your agent the video generation skill.</p>
        <div class="code-block">
          <button class="copy-btn" onclick="copyCode(this)">Copy</button>
          <code>npx skills add https://github.com/andy-t-wang/x402-worldchain --skill x402-video-generator</code>
        </div>
      </div>

      <div class="step reveal" style="margin-bottom:28px;">
        <p class="step-label">Step 2 &mdash; Verify with World&nbsp;ID (optional)</p>
        <p class="section-desc" style="margin-bottom:12px;">If your agent isn't registered in AgentBook yet, tell it to verify. Verified agents generate for free.</p>
        <div class="prompt-block">
          <button class="copy-btn" onclick="copyCode(this)">Copy</button>
          <span class="copy-text">Register yourself in AgentBook using the agentkit-cli so you can generate videos for free.</span>
        </div>
      </div>

      <div class="step reveal" style="margin-bottom:28px;">
        <p class="step-label">Step 3 &mdash; Generate a video</p>
        <p class="section-desc" style="margin-bottom:12px;">Ask your agent to create the video. It handles auth, submission, and polling automatically.</p>
        <div class="prompt-block">
          <button class="copy-btn" onclick="copyCode(this)">Copy</button>
          <span class="copy-text">Generate a video of what you think a day in my life looks like based on our conversations.</span>
        </div>
      </div>
    </section>

    <div class="divider"></div>

    <footer>
      <p>
        Built with
        <a href="https://docs.world.org/agents/agent-kit" target="_blank" rel="noopener">AgentKit</a>
        &middot;
        <a href="https://github.com/coinbase/x402" target="_blank" rel="noopener">x402</a>
        &middot;
        <a href="https://github.com/andy-t-wang/x402-worldchain" target="_blank" rel="noopener">Source</a>
      </p>
    </footer>
  </div>

  <script>
    function copyCode(btn) {
      var container = btn.parentElement;
      var codeEl = container.querySelector('code');
      var copyText = container.querySelector('.copy-text');
      var text = codeEl ? codeEl.textContent : copyText ? copyText.textContent.trim() : container.textContent.replace('Copy', '').trim();
      navigator.clipboard.writeText(text).then(function() {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(function() {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      });
    }

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry, i) {
        if (entry.isIntersecting) {
          setTimeout(function() { entry.target.classList.add('visible'); }, i * 80);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    document.querySelectorAll('.reveal').forEach(function(el) { observer.observe(el); });
  </script>
</body>
</html>`;
