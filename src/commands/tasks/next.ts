import { WorkflowCommand } from "../../cli/command.js";
import { commonFlags, timeFlag } from "../../cli/flags.js";

export default class Next extends WorkflowCommand {
  static description =
    "List incomplete tasks on the selected day sharing the nearest start strictly after the reference moment. Return all ties; duration is not required.";
  static examples = [
    "<%= config.bin %> tasks next",
    "<%= config.bin %> tasks next --time 10:15 --json",
  ];
  static flags = { ...commonFlags, time: timeFlag };
  async run(): Promise<void> {
    const { flags } = await this.parse(Next);
    await this.executeQuery("next", flags);
  }
}
