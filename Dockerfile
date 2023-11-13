FROM debian:stable-slim


WORKDIR /app
COPY . /app

RUN rm -r .git && \
    apt-get update && \
	apt-get install python3 -y && \
	apt-get install python3-pip -y && \
	apt-get install python3-venv -y && \
	apt-get install mariadb-client -y && \
	python3 -m venv flask_env && \
	. flask_env/bin/activate && \
	pip3 install -r requirements.txt && \
	apt-get remove python3-pip -y && apt autoremove -y && apt autoclean -y && \
	rm -rf /var/cache/apt


ADD entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENTRYPOINT [ "/entrypoint.sh" ]

CMD ["python3", "run.py"]
