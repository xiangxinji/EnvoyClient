import { ref } from "vue";

const _locked = ref(false);

export function useLockScreen() {
  function lock() {
    _locked.value = true;
  }

  function unlock() {
    _locked.value = false;
  }

  return {
    locked: _locked,
    lock,
    unlock,
  };
}
