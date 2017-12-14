import django_filters.rest_framework
#from django.core.urlresolvers import reverse_lazy
from django.urls import reverse_lazy
from django.http import Http404
from django.shortcuts import get_object_or_404

from django.views.generic import ListView, CreateView, UpdateView
from braces import views

from rest_framework import viewsets
from rest_framework import filters
from rest_framework import mixins

from rest_framework.authentication import SessionAuthentication, BasicAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import permissions

from .models import Ambulance, Call, Hospital, \
    EquipmentCount, Base, AmbulanceRoute, \
    Profile

from .forms import AmbulanceCreateForm, AmbulanceUpdateForm
    # AmbulanceStatusCreateForm, AmbulanceStatusUpdateForm

from .serializers import ProfileSerializer, AmbulanceSerializer
#    CallSerializer, HospitalSerializer, EquipmentCountSerializer, \
#    AmbulanceRouteSerializer, BaseSerializer

    
#from .serializers import AmbulanceSerializer, AmbulanceStatusSerializer, \
#    CallSerializer, HospitalSerializer, EquipmentCountSerializer, \
#    AmbulanceRouteSerializer, BaseSerializer

# Defines the view for a user when a url is accessed


# Viewsets

class IsUserOrAdminOrSuper(permissions.BasePermission):
    """
    Only user or staff can see or modify
    """

    def has_object_permission(self, request, view, obj):
        return (request.user.is_superuser or
                request.user.is_staff or
                obj.user == request.user)

# Profile viewset

class ProfileViewSet(mixins.RetrieveModelMixin,
                     viewsets.GenericViewSet):

    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = (permissions.IsAuthenticated,
                          IsUserOrAdminOrSuper,)

# Ambulance viewset

class AmbulanceViewSet(mixins.RetrieveModelMixin,
                       viewsets.GenericViewSet):

    #queryset = Ambulance.objects.all()
    serializer_class = AmbulanceSerializer

    def get_queryset(self):

        # return all ambulance if superuser
        user = self.request.user
        if user.is_superuser:
            return Ambulance.objects.all()

        # otherwise only return ambulance that the user can read
        permissions = user.profile.ambulances.filter(can_read=True)
        return permissions.ambulance

# class AmbulanceViewSet(mixins.RetrieveModelMixin,
#                        viewsets.GenericViewSet):

#     queryset = Ambulance.objects.all()
#     serializer_class = AmbulanceSerializer

#     def get_object(self):

#         queryset = self.get_queryset()
#         pk = self.kwargs['pk']
#         user = self.request.user

#         # retrieve object
#         obj = get_object_or_404(queryset, pk=pk)

#         # return ambulance if superuser
#         if user.is_superuser:
#             return obj

#         # return ambulance if user can read it
#         permission = user.profile.ambulances.all().filter(ambulance__id=pk)
#         if permission and permission[0].can_read:
#             return obj

#         raise Http404()
    
# Ambulance list page
class AmbulanceListView(ListView):
    model = Ambulance
    template_name = 'ambulances/ambulance_list.html'
    context_object_name = "ambulances"

# Ambulance list page
class AmbulanceView(CreateView):
    model = Ambulance
    context_object_name = "ambulance_form"
    form_class = AmbulanceCreateForm
    success_url = reverse_lazy('ambulance')

    def get_context_data(self, **kwargs):
        context = super(AmbulanceView, self).get_context_data(**kwargs)
        context['ambulances'] = Ambulance.objects.all().order_by('id')
        return context

# Ambulance update page
class AmbulanceUpdateView(UpdateView):
    model = Ambulance
    form_class = AmbulanceUpdateForm
    template_name = 'ambulances/ambulance_edit.html'
    success_url = reverse_lazy('ambulance')

    def get_object(self, queryset=None):
        obj = Ambulance.objects.get(id=self.kwargs['pk'])
        return obj

    def get_context_data(self, **kwargs):
        context = super(AmbulanceUpdateView, self).get_context_data(**kwargs)
        context['identifier'] = self.kwargs['pk']
        return context

# Call list page
class CallView(ListView):
    model = Call
    template_name = 'ambulances/dispatch_list.html'
    context_object_name = "ambulance_call"

# Admin page
class AdminView(ListView):
    model = Call
    template_name = 'ambulances/dispatch_list.html'
    context_object_name = "ambulance_call"
    
# # AmbulanceStatus list page
# class AmbulanceStatusCreateView(CreateView):
#     model = AmbulanceStatus
#     context_object_name = "ambulance_status_form"
#     form_class = AmbulanceStatusCreateForm
#     success_url = reverse_lazy('status')

#     def get_context_data(self, **kwargs):
#         context = super(AmbulanceStatusCreateView, self).get_context_data(**kwargs)
#         context['statuses'] = AmbulanceStatus.objects.all().order_by('id')
#         return context


# # AmbulanceStatus update page
# class AmbulanceStatusUpdateView(UpdateView):
#     model = AmbulanceStatus
#     form_class = AmbulanceStatusUpdateForm
#     template_name = 'ambulances/ambulance_status_edit.html'
#     success_url = reverse_lazy('status')

#     def get_object(self, queryset=None):
#         obj = AmbulanceStatus.objects.get(id=self.kwargs['pk'])
#         return obj

#     def get_context_data(self, **kwargs):
#         context = super(AmbulanceStatusUpdateView, self).get_context_data(**kwargs)
#         context['id'] = self.kwargs['pk']
#         return context


# Ambulance map page
class AmbulanceMap(views.JSONResponseMixin, views.AjaxResponseMixin, ListView):
    template_name = 'ambulances/ambulance_map.html'

    def get_queryset(self):
        return Ambulance.objects.all()


        
# Custom viewset that only allows listing, retrieving, and updating
class ListRetrieveUpdateViewSet(mixins.ListModelMixin,
                                mixins.RetrieveModelMixin,
                                mixins.UpdateModelMixin,
                                viewsets.GenericViewSet):
    pass


class ListCreateViewSet(mixins.ListModelMixin,
                        mixins.RetrieveModelMixin,
                        mixins.CreateModelMixin,
                        viewsets.GenericViewSet):
    pass


# Defines viewsets
# Viewsets combine different request types (GET, PUSH, etc.) in a single view class
# class AmbulanceViewSet(ListRetrieveUpdateViewSet):

#     # Specify model to expose
#     queryset = Ambulance.objects.all()

#     # Specify the serializer to package the data in JSON
#     serializer_class = AmbulanceSerializer

#     # Specify django REST's filtering system
#     filter_backends = (django_filters.rest_framework.DjangoFilterBackend,)

#     # Specify fields that user can filter GET by
#     filter_fields = ('identifier', 'status')


# class AmbulanceStatusViewSet(viewsets.ReadOnlyModelViewSet):
#     queryset = AmbulanceStatus.objects.all()
#     serializer_class = AmbulanceStatusSerializer


# class CallViewSet(ListCreateViewSet):
#     queryset = Call.objects.all()
#     serializer_class = CallSerializer


# class EquipmentCountViewSet(mixins.UpdateModelMixin, viewsets.GenericViewSet):
#     queryset = EquipmentCount.objects.all()
#     serializer_class = EquipmentCountSerializer


# class HospitalViewSet(viewsets.ReadOnlyModelViewSet):
#     queryset = Hospital.objects.all()
#     serializer_class = HospitalSerializer
#     filter_backends = (django_filters.rest_framework.DjangoFilterBackend,)
#     filter_fields = ('name', 'address')


# class BaseViewSet(viewsets.ReadOnlyModelViewSet):
#     queryset = Base.objects.all()
#     serializer_class = BaseSerializer


# class AmbulanceRouteViewSet(ListCreateViewSet):
#     queryset = AmbulanceRoute.objects.all()
#     serializer_class = AmbulanceRouteSerializer
