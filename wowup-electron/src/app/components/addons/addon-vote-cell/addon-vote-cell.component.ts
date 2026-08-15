import { Component } from "@angular/core";
import { AgRendererComponent } from "ag-grid-angular";
import { ICellRendererParams } from "ag-grid-community";
import { AddonCompatibilityVoteCounts } from "../../../services/ascension/ascension-author-api.service";

@Component({
  selector: "app-addon-vote-cell",
  templateUrl: "./addon-vote-cell.component.html",
  styleUrls: ["./addon-vote-cell.component.scss"],
})
export class AddonVoteCellComponent implements AgRendererComponent {
  public votes?: AddonCompatibilityVoteCounts;

  public agInit(params: ICellRendererParams): void {
    this.votes = params.data.compatibilityVotes;
  }

  public refresh(params: ICellRendererParams): boolean {
    this.votes = params.data.compatibilityVotes;
    return true;
  }
}
