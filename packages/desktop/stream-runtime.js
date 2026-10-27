/** Request ownership and aborts are scoped to the originating renderer. */
function createStreamRegistry() {
  const owners = new Map();
  const valid = id => typeof id === 'string' && id.length > 0 && id.length <= 128;
  const dispose = (sender, state) => {
    if (state.active.size || state.pending.size) return;
    sender.removeListener('destroyed', state.destroy);
    if (owners.get(sender) === state) owners.delete(sender);
  };
  const owner = sender => {
    let state = owners.get(sender);
    if (state) return state;
    state = { active: new Map(), pending: new Map() };
    state.destroy = () => {
      for (const controller of state.active.values()) controller.abort();
      for (const timer of state.pending.values()) clearTimeout(timer);
      owners.delete(sender);
    };
    sender.once('destroyed', state.destroy);
    owners.set(sender, state);
    return state;
  };
  return {
    begin(sender, id) {
      if (!valid(id)) throw new Error('Invalid stream ID');
      const state = owner(sender);
      if (state.active.has(id) || state.active.size >= 32) throw new Error('Stream capacity reached');
      const controller = new AbortController();
      let released = false;
      state.active.set(id, controller);
      const timer = state.pending.get(id);
      if (timer) { clearTimeout(timer); state.pending.delete(id); controller.abort(); }
      return { signal: controller.signal, release() {
        if (released) return;
        released = true;
        state.active.delete(id);
        dispose(sender, state);
      } };
    },
    cancel(sender, id) {
      if (!valid(id)) return false;
      const state = owner(sender);
      if (state.active.has(id)) { state.active.get(id).abort(); return true; }
      if (state.pending.has(id) || state.pending.size >= 32) return false;
      state.pending.set(id, setTimeout(() => { state.pending.delete(id); dispose(sender, state); }, 5000));
      return true;
    },
  };
}
module.exports = { createStreamRegistry };
