import type { TelemetryData } from "../../types/telemetry";

export abstract class BaseComponent {
  protected container: HTMLElement;
  public id: string;
  public title: string;

  constructor(id: string, title: string) {
    this.id = id;
    this.title = title;
    this.container = document.createElement("div");
    this.container.id = `comp-${id}`;
    this.container.className = "dashboard-component card";
    this.container.innerHTML = `
      <div class="card-title">${title}</div>
      <div class="card-content"></div>
    `;
  }

  get element(): HTMLElement {
    return this.container;
  }

  get contentElement(): HTMLElement {
    return this.container.querySelector(".card-content")!;
  }

  abstract update(data: TelemetryData): void;
  abstract render(): void;
}
