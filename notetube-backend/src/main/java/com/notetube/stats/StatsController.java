package com.notetube.stats;

import com.notetube.security.AuthUser;
import com.notetube.stats.StatsDtos.StatsResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class StatsController {

    private final StatsService service;

    public StatsController(StatsService service) {
        this.service = service;
    }

    @GetMapping("/stats")
    public StatsResponse stats(@AuthenticationPrincipal AuthUser user,
                               @RequestHeader(value = "X-Timezone-Offset-Minutes", required = false) String offset) {
        return service.compute(user.id(), offset);
    }
}
