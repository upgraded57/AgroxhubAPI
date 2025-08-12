export class Notification {
  subject: string;
  summary: string;
  type: string;
  milestone?: string;

  private constructor(
    subject: string,
    summary: string,
    type: string,
    milestone?: string
  ) {
    this.subject = subject;
    this.summary = summary;
    this.type = type;
    this.milestone = milestone;
  }

  static follow(subject: string, summary: string) {
    return new Notification(subject, summary, "follow");
  }

  static productReview(subject: string, summary: string) {
    return new Notification(subject, summary, "productReview");
  }

  static productSave(subject: string, summary: string) {
    return new Notification(subject, summary, "productSave");
  }

  static orderPlacement(subject: string, summary: string) {
    return new Notification(subject, summary, "orderPlacement");
  }

  static orderPickup(subject: string, summary: string) {
    return new Notification(subject, summary, "orderPickup");
  }

  static orderInTransit(subject: string, summary: string) {
    return new Notification(subject, summary, "orderInTransit");
  }

  static orderDelivery(subject: string, summary: string) {
    return new Notification(subject, summary, "orderDelivery");
  }

  static milestone(subject: string, summary: string, milestone: string) {
    return new Notification(subject, summary, milestone, "milestone");
  }

  static orderAssignment(subject: string, summary: string) {
    return new Notification(subject, summary, "orderAssignment");
  }

  static outOfStock(subject: string, summary: string) {
    return new Notification(subject, summary, "outOfStock");
  }
}
