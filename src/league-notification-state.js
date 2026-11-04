// Alert acknowledgment is intentionally separate from task validity.
// Opening the bell acknowledges the current notifications; completed lineup
// tasks are removed by buildLeagueAlerts when the roster/lineup is valid.
export function unseenLeagueAlertIds(alerts=[],readIds=[]){
  const seen=new Set(readIds);
  return alerts.filter(alert=>!seen.has(alert.id)).map(alert=>alert.id);
}
export function acknowledgedLeagueAlertIds(readIds=[],newIds=[]){
  return [...new Set([...readIds,...newIds])].slice(-300);
}
export function displayedLeagueAlerts(alerts=[],openedIds=[]){
  const opened=new Set(openedIds);
  return alerts.filter(alert=>opened.has(alert.id));
}
