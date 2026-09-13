// A WAI-ARIA tab list. Click or the arrow keys change the selection, and only
// the selected tab sits in the tab order. Render the matching panel with
// `tabPanelProps(idBase, key)` spread onto its element.
export function TabList({ tabs, selected, onSelect, idBase, label, className }) {
  const keys = tabs.map((tab) => tab.key);

  const onKeyDown = (event) => {
    const index = keys.indexOf(selected);
    const next =
      event.key === "ArrowRight"
        ? keys[(index + 1) % keys.length]
        : event.key === "ArrowLeft"
          ? keys[(index - 1 + keys.length) % keys.length]
          : event.key === "Home"
            ? keys[0]
            : event.key === "End"
              ? keys[keys.length - 1]
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    onSelect(next);
    document.getElementById(tabId(idBase, next))?.focus();
  };

  return (
    <div className={className} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map(({ key, label: text }) => {
        const active = key === selected;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            id={tabId(idBase, key)}
            aria-selected={active}
            aria-controls={panelId(idBase, key)}
            tabIndex={active ? 0 : -1}
            className={active ? "active" : undefined}
            onClick={() => onSelect(key)}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

const tabId = (base, key) => `${base}-tab-${key}`;
const panelId = (base, key) => `${base}-panel-${key}`;

export function tabPanelProps(base, key) {
  return { role: "tabpanel", id: panelId(base, key), "aria-labelledby": tabId(base, key) };
}
