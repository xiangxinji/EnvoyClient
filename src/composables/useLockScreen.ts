import { ref } from "vue";

const _locked = ref(false);
const _quitAttempted = ref(false);

export function useLockScreen() {
  function lock() {
    _locked.value = true;
  }

  function unlock() {
    _locked.value = false;
    _quitAttempted.value = false;
  }

  function notifyQuitAttempt() {
    _quitAttempted.value = true;
  }

  return {
    locked: _locked,
    quitAttempted: _quitAttempted,
    lock,
    unlock,
    notifyQuitAttempt,
  };
}
