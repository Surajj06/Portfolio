import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { VoiceDemoComponent } from './voice-demo.component';
import { MmvExtractorDemoComponent } from './mmv-extractor-demo.component';
import { MmvInserterDemoComponent } from './mmv-inserter-demo.component';
import { MatchingDemoComponent } from './matching-demo.component';
import { MappingWorkspaceDemoComponent } from './mapping-workspace-demo.component';
import { QuoteChatDemoComponent } from './quote-chat-demo.component';
import { GamificationDemoComponent } from './gamification-demo.component';
import { ApiMonitorDemoComponent } from './api-monitor-demo.component';
import { StockDemoComponent } from './stock-demo.component';
import { DailyReportDemoComponent } from './daily-report-demo.component';
import { WhatsappDemoComponent } from './whatsapp-demo.component';

/**
 * Picks the live demo for a project id. Each demo is its own lazily loaded
 * chunk (`@defer`), fetched when idle and mounted as it nears the viewport, so
 * the case-study page stays light until a visitor actually scrolls to it. The
 * server renders only the placeholder.
 */
@Component({
  selector: 'app-project-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    VoiceDemoComponent,
    MmvExtractorDemoComponent,
    MmvInserterDemoComponent,
    MatchingDemoComponent,
    MappingWorkspaceDemoComponent,
    QuoteChatDemoComponent,
    GamificationDemoComponent,
    ApiMonitorDemoComponent,
    StockDemoComponent,
    DailyReportDemoComponent,
    WhatsappDemoComponent
  ],
  styles: [
    `
      :host {
        display: block;
      }
      .ph {
        display: grid;
        place-items: center;
        min-height: 320px;
        border: 1px dashed var(--line-2);
        border-radius: var(--r-lg);
        color: var(--text-3);
        font-family: var(--font-mono);
        font-size: 0.75rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
    `
  ],
  template: `
    @switch (id) {
      @case ('ai-voice-calling-platform') {
        @defer (on viewport; prefetch on idle) { <app-voice-demo /> } @placeholder { <div class="ph">Loading live demo…</div> }
      }
      @case ('mmv-data-extractor') {
        @defer (on viewport; prefetch on idle) { <app-mmv-extractor-demo /> } @placeholder { <div class="ph">Loading live demo…</div> }
      }
      @case ('mmv-master-inserter') {
        @defer (on viewport; prefetch on idle) { <app-mmv-inserter-demo /> } @placeholder { <div class="ph">Loading live demo…</div> }
      }
      @case ('vehicle-catalogue-matching-engine') {
        @defer (on viewport; prefetch on idle) { <app-matching-demo /> } @placeholder { <div class="ph">Loading live demo…</div> }
      }
      @case ('vehicle-mapping-workspace') {
        @defer (on viewport; prefetch on idle) { <app-mapping-workspace-demo /> } @placeholder { <div class="ph">Loading live demo…</div> }
      }
      @case ('conversational-quote-assistant') {
        @defer (on viewport; prefetch on idle) { <app-quote-chat-demo /> } @placeholder { <div class="ph">Loading live demo…</div> }
      }
      @case ('agent-gamification-platform') {
        @defer (on viewport; prefetch on idle) { <app-gamification-demo /> } @placeholder { <div class="ph">Loading live demo…</div> }
      }
      @case ('api-health-monitor') {
        @defer (on viewport; prefetch on idle) { <app-api-monitor-demo /> } @placeholder { <div class="ph">Loading live demo…</div> }
      }
      @case ('stock-intelligence-engine') {
        @defer (on viewport; prefetch on idle) { <app-stock-demo /> } @placeholder { <div class="ph">Loading live demo…</div> }
      }
      @case ('daily-report-automation') {
        @defer (on viewport; prefetch on idle) { <app-daily-report-demo /> } @placeholder { <div class="ph">Loading live demo…</div> }
      }
      @case ('whatsapp-document-verification-bot') {
        @defer (on viewport; prefetch on idle) { <app-whatsapp-demo /> } @placeholder { <div class="ph">Loading live demo…</div> }
      }
    }
  `
})
export class ProjectDemoComponent {
  @Input({ required: true }) id!: string;
}
