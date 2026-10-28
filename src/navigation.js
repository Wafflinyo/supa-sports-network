export const leagueTabs = ['Home', 'Teams', 'Schedule', 'Standings', 'Player Stats', 'Team Stats', 'Free Agency', 'Transactions', 'Voting', 'Playoff Bracket', 'Draft Room', 'Preseason Tournament', 'Sluggers Fantasy', 'SSL History', 'League Rules']

export function visibleLeagueTabs(signedIn, role) {
  return signedIn && ['commissioner', 'gm'].includes(role)
    ? [...leagueTabs, 'Messages', role === 'commissioner' ? 'Commissioner Tools' : 'GM Tools']
    : leagueTabs
}
export function canViewLeaguePage(page, signedIn, role) {
  if (page === 'Messages') return signedIn && ['commissioner', 'gm'].includes(role)
  if (page === 'Commissioner Tools') return signedIn && role === 'commissioner'
  if (page === 'GM Tools') return signedIn && role === 'gm'
  return true
}
