import { useState } from "react";
import { TabList, tabPanelProps } from "./components/TabList.jsx";
import { installModelContextShim } from "./lib/modelContextShim.js";
import { useModelContext } from "./lib/useModelContext.js";
import { AnalysisPage } from "./pages/Analysis.jsx";
import { DemoPage } from "./pages/Demo.jsx";

const PAGES = {
  demo: {
    label: "Demo",
    title: "How keys work in React and with WebMCP",
    blurb: <>Three demos: keys on a simple list, keys on a dynamic list, and WebMCP tools driving that dynamic list. See analysis for a breakdown and recommendations.</>,
    nav: [
      ["#simple", "Simple", "A simple list, with and without keys"],
      ["#dynamic", "Dynamic", "Dynamic lists need keys minted at creation"],
      ["#webmcp", "WebMCP", "WebMCP tools driving the dynamic list"],
    ],
    Page: DemoPage,
  },
  analysis: {
    label: "Analysis",
    title: "Does WebMCP need keys?",
    blurb: (
      <>
        What the demo shows, measured against the native <code>document.modelContext</code> in Chrome 152 on
        2026-09-06, and what that means for the spec and for <code>use-webmcp-tool</code>.
      </>
    ),
    nav: [
      ["#answer", "Answer", "The short answer"],
      ["#native", "Native API", "What the native API does with identity"],
      ["#takeaways", "Takeaways", "What follows"],
    ],
    Page: AnalysisPage,
  },
};

const PAGE_TABS = Object.entries(PAGES).map(([key, { label }]) => ({ key, label }));

// `?page=analysis` opens the analysis tab directly, so either tab is linkable.
function pageFromUrl() {
  const page = new URLSearchParams(location.search).get("page");
  return Object.hasOwn(PAGES, page ?? "") ? page : "demo";
}

function writePageToUrl(page) {
  const params = new URLSearchParams(location.search);
  if (page === "demo") params.delete("page");
  else params.set("page", page);
  const search = params.toString();
  history.replaceState(null, "", `${location.pathname}${search ? `?${search}` : ""}`);
}

export function App() {
  const mcp = useModelContext();
  const [page, setPage] = useState(pageFromUrl);
  const { title, blurb, nav, Page } = PAGES[page];

  const switchTo = (next) => {
    if (next === page) return;
    setPage(next);
    writePageToUrl(next);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-in">
          <span className="wordmark">React keys × WebMCP</span>
          <TabList className="page-tabs" idBase="page" label="Pages" tabs={PAGE_TABS} selected={page} onSelect={switchTo} />
        </div>
      </div>

      <header className="hero">
        <div className="hero-text">
          <h1>{title}</h1>
          <p className="blurb">{blurb}</p>
        </div>
        {/* A contents list: the short name links to the section, the full
            heading beside it says what the visitor will find there. */}
        <nav className="section-nav" aria-label="Sections">
          <span className="section-nav-label">On this page</span>
          {nav.map(([href, label, heading]) => (
            <a key={href} href={href}>
              <span className="section-nav-name">{label}</span>
              <span className="section-nav-title">{heading}</span>
            </a>
          ))}
        </nav>
      </header>

      {/* Keyed on the page so switching tabs unmounts one and mounts the other.
          The demo's tools unregister while the analysis is open, which keeps
          the agent's tool list in lockstep with what is on screen. */}
      <div {...tabPanelProps("page", page)}>
        <Page key={page} mcp={mcp} onInstallShim={installModelContextShim} />
      </div>
    </>
  );
}
