import IframeView from "@/components/IframeView";
import { agentIframes } from "@/lib/agent-iframe";

export default function VilmaPage() {
  return <IframeView title="Margarita" src={agentIframes.vilma} />;
}
