export default function DashboardHero() {
  return (
    <div className="flex flex-col gap-2 pt-4">
      <h2 className="text-[1.75rem] leading-[1.2] font-semibold">Start or open a game</h2>
      <p className="text-muted max-w-xl">
        Start a new game or open a saved one. Score, clock and penalty changes you make in the
        control panel show up on the overlay, the jumbotron and any share links.
      </p>
    </div>
  );
}
