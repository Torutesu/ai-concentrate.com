import type { Client, InValue } from "@libsql/client";
import type { Database, Statement } from "./database";
class LibsqlStatement implements Statement {
  constructor(
    readonly client: Client,
    readonly sql: string,
    readonly args: InValue[] = [],
  ) {}
  bind(...values: unknown[]) {
    return new LibsqlStatement(this.client, this.sql, values as InValue[]);
  }
  async first<T>() {
    const r = await this.client.execute({ sql: this.sql, args: this.args });
    return (r.rows[0] as T) ?? null;
  }
  async all<T>() {
    const r = await this.client.execute({ sql: this.sql, args: this.args });
    return { results: r.rows as T[] };
  }
  async run() {
    const r = await this.client.execute({ sql: this.sql, args: this.args });
    return { meta: { changes: r.rowsAffected } };
  }
}
export class LibsqlDatabase implements Database {
  constructor(private client: Client) {}
  prepare(sql: string) {
    return new LibsqlStatement(this.client, sql);
  }
  async batch(statements: Statement[]) {
    const batch = statements.map((s) => {
      if (!(s instanceof LibsqlStatement) || s.client !== this.client)
        throw Error("Invalid statement owner");
      return { sql: s.sql, args: s.args };
    });
    // libSQL write batches commit all statements together or roll back together.
    return this.client.batch(batch, "write");
  }
}
