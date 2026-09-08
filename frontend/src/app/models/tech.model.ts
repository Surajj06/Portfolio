import { IconName } from '../shared/icons/icon.component';

export interface TechCategory {
  name: string;
  /** One-line description of what this category covers — shown under the
   * name in the skill graph's card header. */
  subtitle: string;
  icon: IconName;
  items: string[];
}
