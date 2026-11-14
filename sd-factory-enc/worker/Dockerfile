FROM eclipse-temurin:17-jdk-jammy
ARG ANDROID_BUILD_TOOLS=35.0.0
ARG ANDROID_PLATFORM=android-35
ARG APKTOOL_VERSION=2.11.1
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH="${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools:${ANDROID_SDK_ROOT}/build-tools/${ANDROID_BUILD_TOOLS}:${PATH}"
RUN apt-get update && apt-get install -y --no-install-recommends curl unzip zip lib32stdc++6 lib32z1 ca-certificates && rm -rf /var/lib/apt/lists/*
RUN mkdir -p ${ANDROID_SDK_ROOT}/cmdline-tools && \
    curl -fsSL https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -o /tmp/cmdline-tools.zip && \
    unzip -q /tmp/cmdline-tools.zip -d ${ANDROID_SDK_ROOT}/cmdline-tools && \
    mv ${ANDROID_SDK_ROOT}/cmdline-tools/cmdline-tools ${ANDROID_SDK_ROOT}/cmdline-tools/latest && \
    rm /tmp/cmdline-tools.zip && yes | sdkmanager --licenses >/dev/null && \
    sdkmanager "platform-tools" "platforms;${ANDROID_PLATFORM}" "build-tools;${ANDROID_BUILD_TOOLS}"
RUN curl -fsSL "https://bitbucket.org/iBotPeaches/apktool/downloads/apktool_${APKTOOL_VERSION}.jar" -o /opt/apktool.jar && \
    printf '#!/bin/sh\nexec java -jar /opt/apktool.jar "$@"\n' > /usr/local/bin/apktool && chmod +x /usr/local/bin/apktool
WORKDIR /srv/worker
COPY package.json ./package.json
RUN npm install --omit=dev
COPY worker.mjs ./worker.mjs
RUN useradd --system --create-home --uid 10001 worker && mkdir -p /data /tmp/factoryenc && chown -R worker:worker /srv/worker /data /tmp/factoryenc
USER worker
ENV WORKER_DATA_DIR=/data
CMD ["node", "worker.mjs"]
