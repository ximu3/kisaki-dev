#import <Foundation/Foundation.h>
#import <UserNotifications/UserNotifications.h>

typedef void (*KisakiNotificationClick)(const char *);

typedef void (*KisakiNotificationCompletion)(void *, int);

@interface KisakiNotificationDelegate : NSObject <UNUserNotificationCenterDelegate>
@property(nonatomic, assign) KisakiNotificationClick receive;
@end

@implementation KisakiNotificationDelegate

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completion {
    completion(UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionList);
}

/// Handles the default click once, including the response that launched this process.
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completion {
    if ([response.actionIdentifier isEqualToString:UNNotificationDefaultActionIdentifier]) {
        self.receive(response.notification.request.identifier.UTF8String);
    }
    completion();
}

@end

/// The notification center holds its delegate weakly; the application owns it through shutdown.
static KisakiNotificationDelegate *receiver;

/// Detaching the delegate leaves delivered requests and their targets in Notification Center.
int kisaki_set_notification_receiver(const char *app_id, KisakiNotificationClick receive) {
    if (receive && ![NSBundle.mainBundle.bundleIdentifier isEqualToString:[NSString stringWithUTF8String:app_id]]) {
        return 0;
    }
    UNUserNotificationCenter *center = UNUserNotificationCenter.currentNotificationCenter;
    if (receive) {
        receiver = [KisakiNotificationDelegate new];
        receiver.receive = receive;
        center.delegate = receiver;
    } else {
        if (center.delegate == receiver) center.delegate = nil;
        receiver = nil;
    }
    return 1;
}

void kisaki_post_notification(const char *app_id, const char *identifier, const char *title, const char *body,
                              void *context, KisakiNotificationCompletion complete) {
    // The center resolves the bundle identity already checked when the receiver connected.
    (void)app_id;
    UNUserNotificationCenter *center = UNUserNotificationCenter.currentNotificationCenter;
    UNMutableNotificationContent *content = [UNMutableNotificationContent new];
    content.title = [NSString stringWithUTF8String:title];
    content.body = [NSString stringWithUTF8String:body];
    UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:[NSString stringWithUTF8String:identifier]
                                                                          content:content trigger:nil];
    [center requestAuthorizationWithOptions:UNAuthorizationOptionAlert
                          completionHandler:^(BOOL granted, NSError *error) {
        if (!granted || error) {
            complete(context, error ? -1 : 0);
            return;
        }
        [center addNotificationRequest:request withCompletionHandler:^(NSError *failure) {
            complete(context, failure ? -1 : 1);
        }];
    }];
}
