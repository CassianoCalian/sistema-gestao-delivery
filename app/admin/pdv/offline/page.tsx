import "../pdv-design-v3.css";
import PdvOfflineBootstrap from "../../../../components/pdv/PdvOfflineBootstrap";

// Esta página estática só renderiza um catálogo previamente salvo neste navegador.
// A sessão de administrador continua obrigatória para qualquer sincronização.
export default function PdvOfflinePage() {
  return <PdvOfflineBootstrap />;
}
