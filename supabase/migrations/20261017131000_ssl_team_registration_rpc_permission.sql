-- Fix GM team registration after adding conference selection.
-- The public RPC calls this SECURITY DEFINER helper; both functions
-- require EXECUTE for authenticated users.
-- The helper still checks auth.uid(), the caller's assigned GM slot,
-- conference capacity, home location and team-logo ownership.
GRANT EXECUTE ON FUNCTION league_private.save_ssl_team(integer,text,uuid,text,text) TO authenticated;
