-- Called after mutations; return the latest queue and match state.
alter function tumble_private.status(uuid) volatile;
