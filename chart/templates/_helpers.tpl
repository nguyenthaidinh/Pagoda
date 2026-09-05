{{/*
Expand the name of PagodaPDF.
*/}}
{{- define "pagodapdf.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "pagodapdf.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "pagodapdf.labels" -}}
helm.sh/chart: {{ include "pagodapdf.chart" . }}
{{ include "pagodapdf.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "pagodapdf.selectorLabels" -}}
app.kubernetes.io/name: {{ include "pagodapdf.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
