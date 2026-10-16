import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/auth.guard";
import { ReminderService } from "../messaging/reminder.service";

@ApiTags("health")
@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly reminders: ReminderService) {}

  @Get()
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: { status: { type: "string", example: "ok" } },
      required: ["status"],
    },
  })
  health(): { status: string; remindersLastRunAt: string | null } {
    const last = this.reminders.lastRunAt;
    const stale = last ? Date.now() - Date.parse(last) > 26 * 60 * 60 * 1000 : false;
    return { status: stale ? "reminders-stale" : "ok", remindersLastRunAt: last };
  }
}
