// Decide which state a data-list view should render. Pure + unit-testable.
//
// Prevents the "error AND empty (0 records)" contradiction seen in the Support
// Tickets screen: when a list fetch FAILS, the UI must show the error state —
// never the "nothing here yet" empty state, which falsely implies the data
// (e.g. a just-created ticket) does not exist.
//
// Precedence: loading > loadError > empty > list.
export function resolveListView({ loading, loadError, itemCount }) {
  if (loading) return "loading";
  if (loadError) return "error"; // load failed -> error, NOT empty
  if (!Number(itemCount)) return "empty"; // genuinely loaded, nothing to show
  return "list";
}
