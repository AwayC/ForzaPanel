import type { TelemetryData } from "../types/telemetry";
import { BaseComponent } from "./ui/BaseComponent";
import { DashboardComponent } from "./ui/Dashboard";
import { PedalsComponent } from "./ui/Pedals";
import { TiresComponent } from "./ui/Tires";
import { GForceComponent } from "./ui/GForce";
import { SteeringComponent } from "./ui/Steering";
import { EngineComponent } from "./ui/Engine";
import { LapComponent } from "./ui/Lap";
import { MiniMapComponent } from "./ui/MiniMap";

export class Dashboard {
  private root: HTMLElement;
  private allComponents: BaseComponent[] = [];
  private activeComponents: BaseComponent[] = [];
  private mode: "casual" | "race" = "casual";

  constructor(container: HTMLElement) {
    this.root = container;
    this.root.innerHTML = `
      <div class="dashboard-toolbar">
        <button id="add-comp-btn" class="btn">\u2b07 \u6dfb\u52a0\u9762\u677f</button>
        <div id="comp-menu" class="panel-menu hidden"></div>
      </div>
      <div class="dashboard-grid"></div>
    `;
    
    // Initialize all possible components
    this.allComponents = [
      new DashboardComponent(),
      new PedalsComponent(),
      new TiresComponent(),
      new GForceComponent(),
      new SteeringComponent(),
      new EngineComponent(),
      new LapComponent(),
      new MiniMapComponent(),
    ];

    this.loadLayout();
    this.renderMenu();
    this.initDragAndDrop();
  }

  private renderMenu(): void {
    const menu = this.root.querySelector("#comp-menu")!;
    const btn = this.root.querySelector("#add-comp-btn")!;
    
    btn.addEventListener("click", () => menu.classList.toggle("hidden"));

    menu.innerHTML = this.allComponents.map(comp => `
      <label class="panel-check">
        <input type="checkbox" data-id="${comp.id}" ${this.activeComponents.includes(comp) ? "checked" : ""}>
        ${comp.title}
      </label>
    `).join("");

    menu.querySelectorAll("input").forEach(input => {
      input.addEventListener("change", (e) => {
        const id = (e.target as HTMLInputElement).dataset.id;
        const comp = this.allComponents.find(c => c.id === id)!;
        if ((e.target as HTMLInputElement).checked) {
          this.activeComponents.push(comp);
        } else {
          this.activeComponents = this.activeComponents.filter(c => c !== comp);
        }
        this.render();
        this.saveLayout();
      });
    });
  }

  private render(): void {
    const grid = this.root.querySelector(".dashboard-grid")!;
    grid.innerHTML = "";
    this.activeComponents.forEach((comp) => {
      grid.appendChild(comp.element);
      // Re-initialize drag for new elements
      const title = comp.element.querySelector(".card-title") as HTMLElement;
      title.setAttribute("draggable", "true");
    });
  }

  private loadLayout(): void {
    const saved = localStorage.getItem("dashboardLayout");
    if (saved) {
      try {
        const ids = JSON.parse(saved) as string[];
        this.activeComponents = ids
          .map(id => this.allComponents.find(c => c.id === id))
          .filter((c): c is BaseComponent => !!c);
      } catch (e) {
        this.activeComponents = [...this.allComponents];
      }
    } else {
      this.activeComponents = [...this.allComponents];
    }
    this.render();
  }

  private saveLayout(): void {
    const ids = this.activeComponents.map(c => c.id);
    localStorage.setItem("dashboardLayout", JSON.stringify(ids));
  }

  public update(data: TelemetryData): void {
    this.activeComponents.forEach((comp) => comp.update(data));
    this.handleWarnings(data);
  }

  private handleWarnings(data: TelemetryData): void {
    if (this.mode === "race") {
      const hasLossOfGrip = 
        Math.abs(data.TireSlipRatioFL) > 1.0 || 
        Math.abs(data.TireSlipRatioFR) > 1.0 || 
        Math.abs(data.TireSlipRatioRL) > 1.0 || 
        Math.abs(data.TireSlipRatioRR) > 1.0;
      
      if (hasLossOfGrip) {
        document.body.style.boxShadow = "inset 0 0 50px rgba(255, 0, 0, 0.5)";
      } else {
        document.body.style.boxShadow = "none";
      }
    }
  }

  public setMode(mode: "casual" | "race"): void {
    this.mode = mode;
  }

  private initDragAndDrop(): void {
    const grid = this.root.querySelector(".dashboard-grid")!;
    let dragSrcEl: HTMLElement | null = null;

    grid.addEventListener("dragstart", (e: any) => {
      const target = e.target.closest(".dashboard-component");
      if (!target) return;
      dragSrcEl = target;
      e.dataTransfer.effectAllowed = "move";
      target.classList.add("dragging");
    });

    grid.addEventListener("dragover", (e) => {
      e.preventDefault();
      return false;
    });

    grid.addEventListener("drop", (e: any) => {
      const target = e.target.closest(".dashboard-component");
      if (dragSrcEl && target && dragSrcEl !== target) {
        const children = Array.from(grid.children);
        const srcIdx = children.indexOf(dragSrcEl);
        const targetIdx = children.indexOf(target);
        
        if (srcIdx < targetIdx) target.after(dragSrcEl);
        else target.before(dragSrcEl);

        // Update activeComponents order
        const newOrderIds = Array.from(grid.children).map(el => el.id.replace("comp-", ""));
        this.activeComponents.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
        this.saveLayout();
      }
    });

    grid.addEventListener("dragend", () => {
      if (dragSrcEl) dragSrcEl.classList.remove("dragging");
    });
  }
}
