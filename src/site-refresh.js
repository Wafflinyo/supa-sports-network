// A full page navigation with a unique query makes the browser request the
// latest deployed index.html rather than reuse a cached PWA document.
// Do not clear the service worker, storage, or the user's signed-in session.
export function freshSiteUrl(href,stamp=Date.now()){
  const url=new URL(href);
  url.searchParams.set('ssl_refresh',String(stamp));
  return url.href;
}
export function refreshSite(location,stamp=Date.now()){
  location.replace(freshSiteUrl(location.href,stamp));
}
