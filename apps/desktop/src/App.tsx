import { ShellHome } from "./features/shell/ShellHome";
import { ShellLayout } from "./features/shell/ShellLayout";
import { StatusBar } from "./features/shell/StatusBar";
import { useAppLifecycle } from "./hooks/useAppLifecycle";

function App() {
  const { phase, appInfo, bridgeOk, error } = useAppLifecycle();

  return (
    <ShellLayout
      footer={<StatusBar phase={phase} bridgeOk={bridgeOk} appInfo={appInfo} />}
    >
      <ShellHome phase={phase} appInfo={appInfo} error={error} />
    </ShellLayout>
  );
}

export default App;
