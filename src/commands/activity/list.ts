import { Flags } from "@oclif/core";
import { WorkflowCommand } from "../../cli/command.js";
import { commonFlags } from "../../cli/flags.js";

export default class List extends WorkflowCommand {
  static description =
    "List recorded Todoist events in the selected local day, chronologically. Events do not establish focus or time spent working.";
  static examples = [
    "<%= config.bin %> activity list",
    "<%= config.bin %> activity list --since 07:00 --json",
  ];
  static flags = {
    ...commonFlags,
    since: Flags.string({
      description:
        "Inclusive lower clock boundary (HH:mm[:ss]). Defaults to the start of the selected day.",
    }),
  };
  async run(): Promise<void> {
    const { flags } = await this.parse(List);
    await this.executeQuery("activity", flags);
  }
}
